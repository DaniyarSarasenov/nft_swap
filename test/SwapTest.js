const { expect } = require("chai");
const { ethers, waffle } = require("hardhat");
const utils = require("ethers/lib/utils");
const { isCallTrace } = require("hardhat/internal/hardhat-network/stack-traces/message-trace");

describe("NFT Swap Test", () => {
    let swapContract;
    let swapOwner;
    let ftContract;
    let nftContract;
    let account1;
    let account2;
    let accounts;
    const swapFee = utils.parseEther("0.01");

    beforeEach(async () => {
        [swapOwner, account1, account2] = await ethers.getSigners();
        accounts = await ethers.getSigners();
        
        // deploy swap contract
        const NFTSwap = await ethers.getContractFactory("NFTSwap");
        swapContract = await NFTSwap.deploy();
        await swapContract.deployed();

        // set Swap active
        await swapContract.setOpenOffer(true);

        // deploy NFT contract
        const TestNFT = await ethers.getContractFactory("TestNFT");
        nftContract = await TestNFT.deploy("TestNFT", "TNFT");
        await nftContract.deployed();

        // deploy FT contract
        const TestFT = await ethers.getContractFactory("TestFT");
        ftContract = await TestFT.deploy();
        await ftContract.deployed();
    });

    it("Create SwapItem with ERC721 and ERC20", async () => {
        await nftContract.connect(account1).mintTo(account1.address);
        await nftContract.connect(account1).approve(swapContract.address, 1); // NFT tokenid 1
        await ftContract.connect(account1).mint(account1.address, 100); // ERC20 100
        await ftContract.connect(account1).approve(swapContract.address, 50);
        await swapContract.connect(account1).createSwapItem(
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
                value: swapFee
            }
        );

        await nftContract.connect(account2).mintTo(account2.address);
        await nftContract.connect(account2).approve(swapContract.address, 2); // NFT tokenid 1
        await ftContract.connect(account2).mint(account2.address, 100); // ERC20 100
        await ftContract.connect(account2).approve(swapContract.address, 50);
        await swapContract.connect(account2).createSwapItem(
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
                value: swapFee
            }
        );

        const swapItems = await swapContract.GetSwapItems();
        const myItems = await swapContract.GetOwnedSwapItems(account1.address);
        expect(swapItems.length).to.be.equal(2)
        expect(myItems.length).to.be.equal(1)
    });

    it("Cancel SwapItem", async() => {
        await nftContract.connect(account1).mintTo(account1.address);
        await nftContract.connect(account1).approve(swapContract.address, 1); // NFT tokenid 1
        await ftContract.connect(account1).mint(account1.address, 100); // ERC20 100
        await ftContract.connect(account1).approve(swapContract.address, 50);
        await swapContract.connect(account1).createSwapItem(
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
                value: swapFee
            }
        );

        const beforeSwapItems = await swapContract.GetSwapItems();
        expect(beforeSwapItems.length).to.be.equal(1)

        await swapContract.connect(account1).CancelSwapItem(1);
        const afterSwapItems = await swapContract.GetSwapItems();
        expect(afterSwapItems.length).to.be.equal(0)
    });

    it("Create & Cancel Offer", async () => {
        await nftContract.connect(account1).mintTo(account1.address);
        await nftContract.connect(account1).approve(swapContract.address, 1); // NFT tokenid 1
        await ftContract.connect(account1).mint(account1.address, 100); // ERC20 100
        await ftContract.connect(account1).approve(swapContract.address, 50);
        await swapContract.connect(account1).createSwapItem(
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
                value: swapFee
            }
        );

        await nftContract.connect(account2).mintTo(account2.address);
        await nftContract.connect(account2).approve(swapContract.address, 2); // tokenid 2
        await ftContract.connect(account2).mint(account2.address, 100);
        await ftContract.connect(account2).approve(swapContract.address, 10);
        await swapContract.connect(account2).createSwapOffer(
            1, // SwapItem ID
            [
                [
                    nftContract.address,
                    [2]
                ]
            ],
            [
                [ftContract.address],
                [10]
            ],
            3 * 24 * 3600 // time 3 days
        );

        await nftContract.connect(account2).mintTo(account2.address);
        await nftContract.connect(account2).approve(swapContract.address, 3); // tokenid 2
        await ftContract.connect(account2).approve(swapContract.address, 10);
        await swapContract.connect(account2).createSwapOffer(
            1, // SwapItem ID
            [
                [
                    nftContract.address,
                    [3]
                ]
            ],
            [
                [ftContract.address],
                [10]
            ],
            3 * 24 * 3600 // time 3 days
        );

        const beforeOffers = await swapContract.GetSwapOffers(account2.address);
        expect(beforeOffers.length).to.equal(2);
        
        expect(await ftContract.balanceOf(account2.address)).to.equal(80);
        expect(await nftContract.balanceOf(account2.address)).to.equal(0);

        await swapContract.connect(account2).CancelOffer(1, 1); // 1: SwapItem ID, 2: Offer ID from 0
        
        const afterOffers = await swapContract.GetSwapOffers(account2.address);
        expect(afterOffers.length).to.equal(1);
        expect(await ftContract.balanceOf(account2.address)).to.equal(90);
        expect(await nftContract.balanceOf(account2.address)).to.equal(1);
    });

    it("Full Swap Test 1:1", async () => {
        await nftContract.connect(account1).mintTo(account1.address);
        await nftContract.connect(account1).mintTo(account1.address);
        await nftContract.connect(account1).mintTo(account1.address);
        await nftContract.connect(account1).approve(swapContract.address, 1); // NFT tokenid 1
        await nftContract.connect(account1).approve(swapContract.address, 2);
        await nftContract.connect(account1).approve(swapContract.address, 3);
        await ftContract.connect(account1).mint(account1.address, 100); // ERC20 100
        await ftContract.connect(account1).approve(swapContract.address, 50);
        await swapContract.connect(account1).createSwapItem(
            [
                [
                    nftContract.address,
                    [1, 2]
                ],
                [
                    nftContract.address,
                    [3]
                ]
            ],
            [
                [ftContract.address],
                [50]
            ],
            {
                value: swapFee
            }
        );
        
        await nftContract.connect(account2).mintTo(account2.address);
        await nftContract.connect(account2).mintTo(account2.address);
        await nftContract.connect(account2).approve(swapContract.address, 4); // tokenid 2
        await nftContract.connect(account2).approve(swapContract.address, 5); // tokenid 3
        await ftContract.connect(account2).mint(account2.address, 100);
        await ftContract.connect(account2).approve(swapContract.address, 10);
        await swapContract.connect(account2).createSwapOffer(
            1,
            [
                [
                    nftContract.address,
                    [4, 5]
                ]
            ],
            [
                [ftContract.address],
                [10]
            ],
            3 * 24 * 3600 // time 3 days
        );

        // Before Confirm
        expect(await ftContract.balanceOf(account1.address)).to.equal(50);
        expect(await nftContract.balanceOf(account1.address)).to.equal(0);
        expect(await ftContract.balanceOf(account2.address)).to.equal(90);
        expect(await nftContract.balanceOf(account2.address)).to.equal(0);
        
        await swapContract.connect(account1).ConfirmSwap(1, 0);
        
        const offers = await swapContract.GetSwapOffers(account2.address);
        expect(offers.length).to.equal(0);

        expect(await ftContract.balanceOf(account1.address)).to.equal(60);
        expect(await nftContract.balanceOf(account1.address)).to.equal(2);
        expect(await ftContract.balanceOf(account2.address)).to.equal(140);
        expect(await nftContract.balanceOf(account2.address)).to.equal(3);
    });

    it("Full swap Test 1:10", async () => {
        await nftContract.connect(account1).mintTo(account1.address);
        await nftContract.connect(account1).approve(swapContract.address, 1); // NFT tokenid 1
        await ftContract.connect(account1).mint(account1.address, 100); // ERC20 100
        await ftContract.connect(account1).approve(swapContract.address, 50);
        await swapContract.connect(account1).createSwapItem(
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
                value: swapFee
            }
        );

        let nftTokenID = 2;
        for (let i = 1; i < 11; i++) {
            await nftContract.connect(accounts[i]).mintTo(accounts[i].address);
            await nftContract.connect(accounts[i]).approve(swapContract.address, nftTokenID); // tokenid 2
            await ftContract.connect(accounts[i]).mint(accounts[i].address, 100);
            await ftContract.connect(accounts[i]).approve(swapContract.address, 10);
            await swapContract.connect(accounts[i]).createSwapOffer(
                1, // SwapItem ID
                [
                    [
                        nftContract.address,
                        [nftTokenID]
                    ]
                ],
                [
                    [ftContract.address],
                    [10]
                ],
                3 * 24 * 3600 // time 3 days
            );

            nftTokenID++;
        }

        // Item Owner Select 3
        await swapContract.connect(account1).ConfirmSwap(1, 2); // offerIndex started 0 

        const offers = await swapContract.GetSwapOffers(accounts[3].address);
        expect(offers.length).to.equal(0);

        const swapItem = await swapContract.GetSwapItembyIndex(1);
        expect(swapItem.state).to.equal(1); // 1 is Release swap state
    })
});