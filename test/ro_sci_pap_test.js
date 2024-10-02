const { time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const chai = require("chai");
const web3 = require("web3");
const { ZERO_ADDRESS } = require("@openzeppelin/test-helpers/src/constants");

chai.config.showDiff = true;
const expect = chai.expect;

/*
 * See docs: https://www.trufflesuite.com/docs/truffle/testing/writing-tests-in-javascript
 */
describe("RoSciPap", () => {
    let nonce0 = '0123456789abcdef';
    let move0 = 3; // paper
    let hash0 = '0x2d388c7fe868e61548ff000b0f15ff32c7792d8322ca9d1541559e59ca8641fe';
    let nonce1 = 'fedcba9876543210';
    let move1 = 1; // rock
    let hash1 = '0x89392405eb2642a912daae088b36b056b6aa3dc7892bd3004c765db349901a84';

    async function deployContract() {
        let accounts = await ethers.getSigners();
        let peer = accounts[1];
        let addresses = await Promise.all(accounts.map((a) => a.getAddress()));
        //console.log(addresses);
        let RoSciPap = await ethers.getContractFactory("RoSciPap");
        let instance = await RoSciPap.deploy(addresses[1]);
        let ev = await instance.queryFilter(instance.filters.GameStarted);
        expect(ev).to.have.lengthOf(1);
        expect(ev[0].args.player1).to.be.equals(addresses[0]);
        expect(ev[0].args.player2).to.be.equals(addresses[1]);
        return { instance, addresses, peer };
    }

    it("GameStarted", async () => {
        let { instance, } = await deployContract();

        await expect(instance.state())
            .to.eventually.equal(0); // AcceptsHashes
    })

    it("plays to win", async () => {
        let { instance, addresses, peer } = await deployContract();
        await expect(instance.connect(peer).sendHash(hash1))
            .to.not.emit(instance, 'HashesReceived');

        await expect(instance.sendHash(hash0))
            .to.emit(instance, 'HashesReceived');
        await expect(instance.state())
            .to.eventually.equal(1); // AcceptsMoves

        await expect(instance.sendMove(move0, web3.utils.asciiToHex(nonce0)))
            .to.not.emit(instance, 'Resolved');
        await expect(instance.connect(peer).sendMove(move1, web3.utils.asciiToHex(nonce1)))
            .to.emit(instance, 'Resolved')
            .withArgs(move0, move1, addresses[0]);
        await expect(instance.state())
            .to.eventually.equal(2); // Resolved
    })


    it("plays to draw", async () => {
        let { instance, addresses, peer } = await deployContract();
        await expect(instance.connect(peer).sendHash(hash0))
            .to.not.emit(instance, 'HashesReceived');

        await expect(instance.sendHash(hash0))
            .to.emit(instance, 'HashesReceived');
        await expect(instance.state())
            .to.eventually.equal(1); // AcceptsMoves

        await expect(instance.sendMove(move0, web3.utils.asciiToHex(nonce0)))
            .to.not.emit(instance, 'Resolved');
        await expect(instance.connect(peer).sendMove(move0, web3.utils.asciiToHex(nonce0)))
            .to.emit(instance, 'Resolved')
            .withArgs(move0, move0, ZERO_ADDRESS);
        await expect(instance.state())
            .to.eventually.equal(2); // Resolved
    })

    it("withdraws at game start", async () => {
        let { instance, addresses, peer } = await deployContract();

        await expect(instance.sendHash(hash0))
            .to.not.emit(instance, 'HashesReceived');
        await expect(instance.connect(peer).withdraw())
            .to.emit(instance, 'Withdrawn');

        await expect(instance.state())
            .to.eventually.equal(3); // Withdrawn

        await expect(instance.resolve())
            .to.be.revertedWith("wrong state");
    })

    it("withdraw triggers forfeit of a non-responsive player", async function () {
        let { instance, addresses, peer } = await deployContract();

        await expect(instance.sendHash(hash0))
            .to.not.emit(instance, 'HashesReceived');
        await expect(instance.connect(peer).sendHash(hash1))
            .to.emit(instance, 'HashesReceived');
        await expect(instance.sendMove(move0, web3.utils.asciiToHex(nonce0)))
            .to.not.emit(instance, 'Resolved');

        // too early
        await expect(instance.withdraw())
            .to.be.revertedWith("cannot withdraw at AcceptsMoves stage, wait for expiration");

        await time.increase(301);
        await expect(instance.withdraw())
            .to.emit(instance, 'Resolved')
            .withArgs(move0, 0, addresses[0]);

        await expect(instance.state())
            .to.eventually.equal(2); // Resolved
    })

});
