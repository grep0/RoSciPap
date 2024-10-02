# Rock-Scissors-Paper smart contract exercise

Two stage resolution:

* One of the players creates the game contract.
* `GameStarted()` emitted to let the other player know that the game started.
* Each player chooses Rock, Scissors or Paper, and a random 16 byte nonce,
and computes the SHA265 hash of 17 byte (nonce + uint8(move)).
Then they call `sendHash`.
* When both players have sent their hashes, `HashReceived` emitted.
* Each player calls `sendMove` with move and nonce. The server verifies hashes.
* When both players have sent their moves, `Resolved` emitted.
* Player can request `resolve` that will return the same as `Resolved` event.