async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with the account: ", deployer.address);
  
    const NFTSwapBox = await ethers.getContractFactory(
      "NFTSwapBox"
    );

    const swapper = await NFTSwapBox.deploy(
      
    );
    await swapper.deployed();
  
    console.log(
      "NFTSwapBox contract is deployed to address: ",
      swapper.address
    );
  }
  
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
    });
  