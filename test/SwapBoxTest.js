const { expect } = require("chai");
const { ethers, waffle } = require("hardhat");
const utils = require("ethers/lib/utils");
const { isCallTrace } = require("hardhat/internal/hardhat-network/stack-traces/message-trace");
const { BigNumber } = require("@ethersproject/bignumber");

describe("NFT SwapBOX Test", () => {
    let swapBoxContract;
    let swapOwner;
    let ftContract;
    let nftContract;
    let account1;
    let account2;
    let accounts;
    let swapFee;
    const State = {
        Initiated: 0,
        Waiting_for_offers: 1,
        Offered: 2,
        Destroyed: 3
    };

    beforeEach(async () => {
        [swapOwner, account1, account2] = await ethers.getSigners();
        accounts = await ethers.getSigners();
        
        // deploy swap contract
        const NFTSwap = await ethers.getContractFactory("NFTSwapBox");
        swapBoxContract = await NFTSwap.deploy();
        await swapBoxContract.deployed();

        // set Swap active
        await swapBoxContract.setSwapState(true);

        // deploy NFT contract
        const TestNFT = await ethers.getContractFactory("TestNFT");
        nftContract = await TestNFT.deploy("TestNFT", "TNFT");
        await nftContract.deployed();

        // deploy FT contract
        const TestFT = await ethers.getContractFactory("TestFT");
        ftContract = await TestFT.deploy();
        await ftContract.deployed();

        await swapBoxContract.addWhiteListToken(ftContract.address);
        swapFee = await swapBoxContract.getSwapPrices();
    });

    it("Create SwapBox with ERC721 and ERC20", async () => {
        await nftContract.connect(account1).mintTo(account1.address);
        await nftContract.connect(account1).approve(swapBoxContract.address, 1); // NFT tokenid 1
        await ftContract.connect(account1).mint(account1.address, 100); // ERC20 100
        await ftContract.connect(account1).approve(swapBoxContract.address, 50);
        await swapBoxContract.connect(account1).createBox(
            [
                [
                    nftContract.address,
                    [1]
                ]
            ],
            [
                [ftContract.address],
                [50]
            ],
            {
                value: swapFee[0] // CreateBox Fee
            }
        );

        await nftContract.connect(account2).mintTo(account2.address);
        await nftContract.connect(account2).approve(swapBoxContract.address, 2); // NFT tokenid 1
        await ftContract.connect(account2).mint(account2.address, 100); // ERC20 100
        await ftContract.connect(account2).approve(swapBoxContract.address, 50);
        await swapBoxContract.connect(account2).createBox(
            [
                [
                    nftContract.address,
                    [2]
                ]
            ],
            [
                [ftContract.address],
                [50]
            ],
            {
                value: swapFee[0] // CreateBox Fee
            }
        );

        const swapItems = await swapBoxContract.getBoxesByState(State.Initiated);
        const myItems = await swapBoxContract.getOwnedSwapBoxes(account1.address, State.Initiated);

        expect(swapItems[0].erc721Tokens[0].tokenAddr).to.be.equal(nftContract.address);
        expect(swapItems.length).to.be.equal(2)
        expect(myItems.length).to.be.equal(1)
    });

    it("To Waiting_for_Offer SwapBox", async () => {
        await nftContract.connect(account1).mintTo(account1.address);
        await nftContract.connect(account1).approve(swapBoxContract.address, 1); // NFT tokenid 1
        await ftContract.connect(account1).mint(account1.address, 100); // ERC20 100
        await ftContract.connect(account1).approve(swapBoxContract.address, 50);
        await swapBoxContract.connect(account1).createBox(
            [
                [
                    nftContract.address,
                    [1]
                ]
            ],
            [
                [ftContract.address],
                [50]
            ],
            {
                value: swapFee[0] // CreateBox Fee
            }
        );

        await nftContract.connect(account2).mintTo(account2.address);
        await nftContract.connect(account2).approve(swapBoxContract.address, 2); // NFT tokenid 1
        await ftContract.connect(account2).mint(account2.address, 100); // ERC20 100
        await ftContract.connect(account2).approve(swapBoxContract.address, 50);
        await swapBoxContract.connect(account2).createBox(
            [
                [
                    nftContract.address,
                    [2]
                ]
            ],
            [
                [ftContract.address],
                [50]
            ],
            {
                value: swapFee[0] // CreateBox Fee
            }
        );

        const swapItems = await swapBoxContract.getBoxesByState(State.Initiated);
        const myInitiateItems = await swapBoxContract.getOwnedSwapBoxes(account1.address, State.Initiated);

        expect(swapItems.length).to.be.equal(2)
        expect(myInitiateItems.length).to.be.equal(1)

        await swapBoxContract.connect(account1).toWaitingForOffers(myInitiateItems[0].id, {value: swapFee[1]});
        const myWaitingItems = await swapBoxContract.getOwnedSwapBoxes(account1.address, State.Waiting_for_offers);
        expect(myWaitingItems.length).to.be.equal(1)
    });

    it("To Offered SwapBox", async () => {
        await nftContract.connect(account1).mintTo(account1.address);
        await nftContract.connect(account1).approve(swapBoxContract.address, 1); // NFT tokenid 1
        await ftContract.connect(account1).mint(account1.address, 100); // ERC20 100
        await ftContract.connect(account1).approve(swapBoxContract.address, 50);
        await swapBoxContract.connect(account1).createBox(
            [
                [
                    nftContract.address,
                    [1]
                ]
            ],
            [
                [ftContract.address],
                [50]
            ],
            {
                value: swapFee[0] // CreateBox Fee
            }
        );

        await nftContract.connect(account2).mintTo(account2.address);
        await nftContract.connect(account2).approve(swapBoxContract.address, 2); // NFT tokenid 1
        await ftContract.connect(account2).mint(account2.address, 100); // ERC20 100
        await ftContract.connect(account2).approve(swapBoxContract.address, 50);
        await swapBoxContract.connect(account2).createBox(
            [
                [
                    nftContract.address,
                    [2]
                ]
            ],
            [
                [ftContract.address],
                [50]
            ],
            {
                value: swapFee[0] // CreateBox Fee
            }
        );

        const swapItems = await swapBoxContract.getBoxesByState(State.Initiated);
        const myInitiateItems = await swapBoxContract.getOwnedSwapBoxes(account1.address, State.Initiated);

        expect(swapItems.length).to.be.equal(2)
        expect(myInitiateItems.length).to.be.equal(1)

        await swapBoxContract.connect(account1).toOffer(myInitiateItems[0].id, {value: swapFee[2]});
        const myWaitingItems = await swapBoxContract.getOwnedSwapBoxes(account1.address, State.Offered);
        expect(myWaitingItems.length).to.be.equal(1)
    });

    it("To Destroyed SwapBox", async () => {
        await nftContract.connect(account1).mintTo(account1.address);
        await nftContract.connect(account1).approve(swapBoxContract.address, 1); // NFT tokenid 1
        await ftContract.connect(account1).mint(account1.address, 100); // ERC20 100
        await ftContract.connect(account1).approve(swapBoxContract.address, 50);
        await swapBoxContract.connect(account1).createBox(
            [
                [
                    nftContract.address,
                    [1]
                ]
            ],
            [
                [ftContract.address],
                [50]
            ],
            {
                value: swapFee[0] // CreateBox Fee
            }
        );

        await nftContract.connect(account2).mintTo(account2.address);
        await nftContract.connect(account2).approve(swapBoxContract.address, 2); // NFT tokenid 1
        await ftContract.connect(account2).mint(account2.address, 100); // ERC20 100
        await ftContract.connect(account2).approve(swapBoxContract.address, 50);
        await swapBoxContract.connect(account2).createBox(
            [
                [
                    nftContract.address,
                    [2]
                ]
            ],
            [
                [ftContract.address],
                [50]
            ],
            {
                value: swapFee[0] // CreateBox Fee
            }
        );

        const swapItems = await swapBoxContract.getBoxesByState(State.Initiated);
        const myInitiateItems = await swapBoxContract.getOwnedSwapBoxes(account1.address, State.Initiated);

        expect(swapItems.length).to.be.equal(2)
        expect(myInitiateItems.length).to.be.equal(1)

        await swapBoxContract.connect(account1).destroyBox(myInitiateItems[0].id, {value: swapFee[3]});
        const myWaitingItems = await swapBoxContract.getOwnedSwapBoxes(account1.address, State.Destroyed);
        expect(myWaitingItems.length).to.be.equal(1)

        const nftCount = await nftContract.balanceOf(account1.address);
        expect(nftCount).to.be.equal(1);
    });

    it("Link SwapBox to other", async () => {
        await nftContract.connect(account1).mintTo(account1.address);
        await nftContract.connect(account1).approve(swapBoxContract.address, 1); // NFT tokenid 1
        await ftContract.connect(account1).mint(account1.address, 100); // ERC20 100
        await ftContract.connect(account1).approve(swapBoxContract.address, 50);
        await swapBoxContract.connect(account1).createBox(
            [
                [
                    nftContract.address,
                    [1]
                ]
            ],
            [
                [ftContract.address],
                [50]
            ],
            {
                value: swapFee[0] // CreateBox Fee
            }
        );

        await nftContract.connect(account2).mintTo(account2.address);
        await nftContract.connect(account2).approve(swapBoxContract.address, 2); // NFT tokenid 1
        await ftContract.connect(account2).mint(account2.address, 100); // ERC20 100
        await ftContract.connect(account2).approve(swapBoxContract.address, 50);
        await swapBoxContract.connect(account2).createBox(
            [
                [
                    nftContract.address,
                    [2]
                ]
            ],
            [
                [ftContract.address],
                [50]
            ],
            {
                value: swapFee[0] // CreateBox Fee
            }
        );

        const swapItems = await swapBoxContract.getBoxesByState(State.Initiated);
        const myInitiateItems = await swapBoxContract.getOwnedSwapBoxes(account1.address, State.Initiated);

        expect(swapItems.length).to.be.equal(2)
        expect(myInitiateItems.length).to.be.equal(1)

        await swapBoxContract.connect(account1).toWaitingForOffers(swapItems[0].id, {value: swapFee[1]});
        await swapBoxContract.connect(account2).linkBox(swapItems[0].id, swapItems[1].id);

        const offeredBoxes = await swapBoxContract.getOfferedSwapBoxes(swapItems[0].id);
        expect(offeredBoxes.length).to.be.equal(1)

        const waitingBoxes = await swapBoxContract.getWaitingSwapBoxes(swapItems[1].id);
        expect(waitingBoxes.length).to.be.equal(1)
    });

    it("DeList SwapBox", async () => {
        await nftContract.connect(account1).mintTo(account1.address);
        await nftContract.connect(account1).approve(swapBoxContract.address, 1); // NFT tokenid 1
        await ftContract.connect(account1).mint(account1.address, 100); // ERC20 100
        await ftContract.connect(account1).approve(swapBoxContract.address, 50);
        await swapBoxContract.connect(account1).createBox(
            [
                [
                    nftContract.address,
                    [1]
                ]
            ],
            [
                [ftContract.address],
                [50]
            ],
            {
                value: swapFee[0] // CreateBox Fee
            }
        );

        await nftContract.connect(account2).mintTo(account2.address);
        await nftContract.connect(account2).approve(swapBoxContract.address, 2); // NFT tokenid 1
        await ftContract.connect(account2).mint(account2.address, 100); // ERC20 100
        await ftContract.connect(account2).approve(swapBoxContract.address, 50);
        await swapBoxContract.connect(account2).createBox(
            [
                [
                    nftContract.address,
                    [2]
                ]
            ],
            [
                [ftContract.address],
                [50]
            ],
            {
                value: swapFee[0] // CreateBox Fee
            }
        );

        const swapItems = await swapBoxContract.getBoxesByState(State.Initiated);
        expect(swapItems.length).to.be.equal(2)

        await swapBoxContract.connect(account1).toWaitingForOffers(swapItems[0].id, {value: swapFee[1]});
        await swapBoxContract.connect(account2).linkBox(swapItems[0].id, swapItems[1].id);

        await swapBoxContract.connect(account1).deListBox(swapItems[0].id);

        const myInitiateItems = await swapBoxContract.getOwnedSwapBoxes(account1.address, State.Initiated);
        expect(myInitiateItems.length).to.be.equal(1)

        const offeredBoxes = await swapBoxContract.getOfferedSwapBoxes(swapItems[0].id);
        expect(offeredBoxes.length).to.be.equal(0)

        const waitingBoxes = await swapBoxContract.getWaitingSwapBoxes(swapItems[1].id);
        expect(waitingBoxes.length).to.be.equal(0)
    });

    it("DeOffer SwapBox", async () => {
        await nftContract.connect(account1).mintTo(account1.address);
        await nftContract.connect(account1).approve(swapBoxContract.address, 1); // NFT tokenid 1
        await ftContract.connect(account1).mint(account1.address, 100); // ERC20 100
        await ftContract.connect(account1).approve(swapBoxContract.address, 50);
        await swapBoxContract.connect(account1).createBox(
            [
                [
                    nftContract.address,
                    [1]
                ]
            ],
            [
                [ftContract.address],
                [50]
            ],
            {
                value: swapFee[0] // CreateBox Fee
            }
        );

        await nftContract.connect(account2).mintTo(account2.address);
        await nftContract.connect(account2).approve(swapBoxContract.address, 2); // NFT tokenid 1
        await ftContract.connect(account2).mint(account2.address, 100); // ERC20 100
        await ftContract.connect(account2).approve(swapBoxContract.address, 50);
        await swapBoxContract.connect(account2).createBox(
            [
                [
                    nftContract.address,
                    [2]
                ]
            ],
            [
                [ftContract.address],
                [50]
            ],
            {
                value: swapFee[0] // CreateBox Fee
            }
        );

        const swapItems = await swapBoxContract.getBoxesByState(State.Initiated);
        expect(swapItems.length).to.be.equal(2)

        await swapBoxContract.connect(account1).toWaitingForOffers(swapItems[0].id, {value: swapFee[1]});
        await swapBoxContract.connect(account2).linkBox(swapItems[0].id, swapItems[1].id);

        await swapBoxContract.connect(account2).deOffer(swapItems[1].id);

        const myInitiateItems = await swapBoxContract.getOwnedSwapBoxes(account2.address, State.Initiated);
        expect(myInitiateItems.length).to.be.equal(1)

        const offeredBoxes = await swapBoxContract.getOfferedSwapBoxes(swapItems[0].id);
        expect(offeredBoxes.length).to.be.equal(0)

        const waitingBoxes = await swapBoxContract.getWaitingSwapBoxes(swapItems[1].id);
        expect(waitingBoxes.length).to.be.equal(0)
    });


    it("SwapBox--Test", async () => {
        await nftContract.connect(account1).mintTo(account1.address);
        await nftContract.connect(account1).approve(swapBoxContract.address, 1); // NFT tokenid 1
        await ftContract.connect(account1).mint(account1.address, 100); // ERC20 100
        await ftContract.connect(account1).approve(swapBoxContract.address, 50);
        await swapBoxContract.connect(account1).createBox(
            [
                [
                    nftContract.address,
                    [1]
                ]
            ],
            [
                [ftContract.address],
                [50]
            ],
            {
                value: swapFee[0] // CreateBox Fee
            }
        );

        await nftContract.connect(account2).mintTo(account2.address);
        await nftContract.connect(account2).approve(swapBoxContract.address, 2); // NFT tokenid 1
        await ftContract.connect(account2).mint(account2.address, 100); // ERC20 100
        await ftContract.connect(account2).approve(swapBoxContract.address, 50);
        await swapBoxContract.connect(account2).createBox(
            [
                [
                    nftContract.address,
                    [2]
                ]
            ],
            [
                [ftContract.address],
                [50]
            ],
            {
                value: swapFee[0] // CreateBox Fee
            }
        );

        const swapItems = await swapBoxContract.getBoxesByState(State.Initiated);
        expect(swapItems.length).to.be.equal(2)

        await swapBoxContract.connect(account1).toWaitingForOffers(swapItems[0].id, {value: swapFee[1]});
        await swapBoxContract.connect(account2).linkBox(swapItems[0].id, swapItems[1].id);

        await swapBoxContract.connect(account1).swapBox(swapItems[0].id, swapItems[1].id);

        const myInitiateItems = await swapBoxContract.getOwnedSwapBoxes(account2.address, State.Initiated);
        expect(myInitiateItems.length).to.be.equal(1)

        const afterWwapItems = await swapBoxContract.getBoxesByState(State.Initiated);
        expect(afterWwapItems.length).to.be.equal(2)
    });
});