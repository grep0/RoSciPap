const RoSciPap = artifacts.require("RoSciPap");
const truffleAssert = require('truffle-assertions');
const { time } = require("@openzeppelin/test-helpers");
const web3 = require('web3');

/*
 * See docs: https://www.trufflesuite.com/docs/truffle/testing/writing-tests-in-javascript
 */
contract("RoSciPap", function (accounts) {
  let nonce0 = '0123456789abcdef';
  let move0 = 3; // paper
  let hash0 = '0x2d388c7fe868e61548ff000b0f15ff32c7792d8322ca9d1541559e59ca8641fe';
  let nonce1 = 'fedcba9876543210';
  let move1 = 1; // rock
  let hash1 = '0x89392405eb2642a912daae088b36b056b6aa3dc7892bd3004c765db349901a84';

  it("emits GameStarted", async function() {
    let instance = await RoSciPap.new(accounts[1], { from: accounts[0] });

    let state = await instance.state();
    assert.equal(state, 0); // AcceptsHashes
    const events = await instance.getPastEvents("GameStarted", {
      fromBlock: 0,
      toBlock: "latest",
    });
    assert.equal(events.length, 1);
    //console.log(events);
    assert.equal(events[0].args.player1, accounts[0]);
    assert.equal(events[0].args.player2, accounts[1]);
  })

  it("plays to win", async function() {
    let instance = await RoSciPap.new(accounts[1], { from: accounts[0] });

    let sendHash1 = await instance.sendHash(hash1, { from: accounts[1] });
    truffleAssert.eventNotEmitted(sendHash1, 'HashesReceived');
    let sendHash0 = await instance.sendHash(hash0, { from: accounts[0] });
    truffleAssert.eventEmitted(sendHash0, 'HashesReceived');
    let state = await instance.state();
    assert.equal(state, 1); // AcceptsMoves

    let sendMove0 = await instance.sendMove(move0, web3.utils.asciiToHex(nonce0), { from: accounts[0] });
    truffleAssert.eventNotEmitted(sendMove0, 'Resolved');
    let sendMove1 = await instance.sendMove(move1, web3.utils.asciiToHex(nonce1), { from: accounts[1] });
    state = await instance.state();
    assert.equal(state, 2); // Resolved
    truffleAssert.eventEmitted(sendMove1, 'Resolved');

    let ret = await instance.resolve();
    assert.equal(ret.move1, move0);
    assert.equal(ret.move2, move1);
    assert.equal(ret.winner, accounts[0]);  // paper beats rock
  })

  it("plays to draw", async function() {
    let instance = await RoSciPap.new(accounts[1], { from: accounts[0] });

    let sendHash0 = await instance.sendHash(hash0, { from: accounts[0] });
    truffleAssert.eventNotEmitted(sendHash0, 'HashesReceived');
    let sendHash1 = await instance.sendHash(hash0, { from: accounts[1] });
    truffleAssert.eventEmitted(sendHash1, 'HashesReceived');
    let state = await instance.state();
    assert.equal(state, 1); // AcceptsMoves

    let sendMove0 = await instance.sendMove(move0, web3.utils.asciiToHex(nonce0), { from: accounts[0] });
    truffleAssert.eventNotEmitted(sendMove0, 'Resolved');
    let sendMove1 = await instance.sendMove(move0, web3.utils.asciiToHex(nonce0), { from: accounts[1] });
    state = await instance.state();
    assert.equal(state, 2); // Resolved
    truffleAssert.eventEmitted(sendMove1, 'Resolved');

    let ret = await instance.resolve();
    assert.equal(ret.move1, move0);
    assert.equal(ret.move2, move0);
    assert.equal(ret.winner, 0);  // no winner
  })

  it("withdraws at game start", async function() {
    let instance = await RoSciPap.new(accounts[1], { from: accounts[0] });

    let sendHash0 = await instance.sendHash(hash0, { from: accounts[0] });
    truffleAssert.eventNotEmitted(sendHash0, 'HashesReceived');
    
    let withdraw1 = await instance.withdraw({ from: accounts[1] });
    truffleAssert.eventEmitted(withdraw1, 'Withdrawn');

    let state = await instance.state();
    assert.equal(state, 3); // Withdrawn

    await truffleAssert.reverts(instance.resolve(), "wrong state");
  })

  it("withdraw triggers forfeit of a non-responsive player", async function() {
    let instance = await RoSciPap.new(accounts[1], { from: accounts[0] });

    let sendHash0 = await instance.sendHash(hash0, { from: accounts[0] });
    truffleAssert.eventNotEmitted(sendHash0, 'HashesReceived');
    let sendHash1 = await instance.sendHash(hash0, { from: accounts[1] });
    truffleAssert.eventEmitted(sendHash1, 'HashesReceived');
    let state = await instance.state();
    assert.equal(state, 1); // AcceptsMoves
    
    let sendMove0 = await instance.sendMove(move0, web3.utils.asciiToHex(nonce0), { from: accounts[0] });
    truffleAssert.eventNotEmitted(sendMove0, 'Resolved');

    await truffleAssert.reverts(instance.withdraw({ from: accounts[0] }), "cannot withdraw at AcceptsMoves stage, wait for expiration");

    await time.increase(301);
    let withdraw0 = await instance.withdraw({ from: accounts[0] });
    truffleAssert.eventEmitted(withdraw0, 'Resolved');

    state = await instance.state();
    assert.equal(state, 2); // Resolved

    let ret = await instance.resolve();
    assert.equal(ret.move1, move0);
    assert.equal(ret.move2, 0); // no move
    assert.equal(ret.winner, accounts[0]);  // no winner
  })


});
