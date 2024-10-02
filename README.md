# Rock-Scissors-Paper smart contract exercise

### Two stage resolution:

* One of the players creates the game contract.
* `GameStarted()` emitted to let the other player know that the game started.
* Each player chooses Rock, Scissors or Paper, and a random 16 byte nonce,
and computes the SHA265 hash of 17 byte (nonce + uint8(move)).
Then they call `sendHash`.
* When both players have sent their hashes, `HashReceive()` emitted. At this moment the players have committed to
the game and must provide their actual moves. No one on blockchain still knows the moves.
* Each player calls `sendMove` with move and nonce. The server verifies that these values have exactly the hash sent before.
* When both players have sent their moves, `Resolved()` emitted.
* Player can request `resolve` that will return the same as `Resolved` event.

### Withdrawal:

* Players can `withdraw` from the game.
* If withdrawal is done before the player sent the hash, it's always successful
* Withdrawal after both players sent their hashes is disallowed, until predefined timeout expired (hardcoded so far)
* After timeout a player can call `withdraw` to terminate the game. If only one player called `sendMove` by that moment,
he claims victory by forfeit.