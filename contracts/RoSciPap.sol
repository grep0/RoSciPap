// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.0 <0.9.0;

contract RoSciPap {
    enum Move {
        None,
        Rock,
        Scissors,
        Paper
    }

    struct Player {
        address addr;
        bytes32 received_hash;
        Move  received_move;
    }
    Player[2] player;

    enum State {
        AcceptsHashes,
        AcceptsMoves,
        Resolved,
        Withdrawn
    }

    State public state;

    uint constant TIMEOUT_SEC = 300;
    uint deadline;

    event GameStarted(address player1, address player2);
    event HashesReceived();
    event Resolved(Move m1, Move m2, address winner);
    event Withdrawn();

    constructor(address peer) {
        player[0].addr = msg.sender;
        player[1].addr = peer;
        advanceState(State.AcceptsHashes);
        emit GameStarted(msg.sender, peer);
    }

    modifier stateIs(State st) {
        if (state != st) revert("wrong state");
        _;
    }

    function sendHash(bytes32 h) stateIs(State.AcceptsHashes) external {
        uint cur = findPlayer(msg.sender);
        require(player[cur].received_hash == 0, "resending hash is not supported");
        player[cur].received_hash = h;

        bool all_players_done = true;
        for (uint i = 0; i < player.length; i++) {
            if (player[i].received_hash == 0) {
                all_players_done = false;
            }
        }
        if (all_players_done) {
            advanceState(State.AcceptsMoves);
            emit HashesReceived();
        }
    }

    function withdraw() external {
        findPlayer(msg.sender);  // ensure that it's a valid player
        if (state==State.Resolved || state==State.Withdrawn) return;
        if (state==State.AcceptsMoves) {
            if (block.timestamp <= deadline) {
                revert("cannot withdraw at AcceptsMoves stage, wait for expiration");
            }
            // If only one player filed the move, the game is forfeited
            uint r = resolveInternal(player[0].received_move, player[1].received_move);
            if (r != 0) {
                advanceState(State.Resolved);
                emit Resolved(player[0].received_move, player[1].received_move, player[r-1].addr);
                return;
            }
        }
        advanceState(State.Withdrawn);
        emit Withdrawn();
    }

    function sendMove(Move mv, bytes16 nonce) stateIs(State.AcceptsMoves) external {
        require(mv != Move.None, "None move is not allowed");
        uint cur = findPlayer(msg.sender);
        require(player[cur].received_move == Move.None, "resending move is not supported"); 
        require(verifyMove(mv, nonce, player[cur].received_hash), "invalid hash for the move");
        player[cur].received_move = mv;

        bool all_players_done = true;
        for (uint i = 0; i < player.length; i++) {
            if (player[i].received_move == Move.None) {
                all_players_done = false;
            }
        }
        if (all_players_done) {
            advanceState(State.Resolved);
            (Move m0, Move m1, address winner) = resolve();
            emit Resolved(m0, m1, winner);
        }
    }

    function resolveInternal(Move move1, Move move2) internal pure returns(uint) {
        if (move1 == move2) {
            return 0;
        }
        if (move1 == Move.None) {
            return 2;
        }
        if (move2 == Move.None) {
            return 1;
        }
        if ((move1 == Move.Rock && move2 == Move.Scissors) ||
            (move1 == Move.Scissors && move2 == Move.Paper) ||
            (move1 == Move.Paper && move2 == Move.Rock)) {
            return 1;
        } else {
            return 2;
        }
    }

    function resolve() stateIs(State.Resolved) public view returns(Move move1, Move move2, address winner) {
        require(state != State.Withdrawn, "transaction withdrawn");
        move1 = player[0].received_move;
        move2 = player[1].received_move;
        uint r = resolveInternal(move1, move2);
        if (r==0) {
            winner = address(0);
        } else if (r==1) {
            winner = player[0].addr;
        } else {
            winner = player[1].addr;
        }
    }

    function findPlayer(address addr) private view returns(uint) {
        for (uint i = 0; i < player.length; i++) {
            if (player[i].addr == addr) return i;
        }
        revert("unknown player");
    }

    function verifyMove(Move mv, bytes16 nonce, bytes32 hash) private pure returns(bool) {
        bytes32 expected = sha256(bytes.concat(nonce, bytes1(uint8(mv))));
        return hash == expected;
    }

    function advanceState(State new_state) private {
        if (state == State.Resolved || state == State.Withdrawn) return;
        state = new_state;
        if (state < State.Resolved) {
            deadline = block.timestamp + TIMEOUT_SEC;
        }
    }
}
