pragma solidity ^0.8.9;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract NFTSwapBox is 
  ReentrancyGuard,
  Ownable
{
    address payable public swapOwner;

    using Counters for Counters.Counter;
    Counters.Counter private _itemCounter;

    uint256[] public swapFees = [0.01 ether, 0.02 ether, 0.01 ether, 0.01 ether];

    bool openSwap = false;

    struct ERC20Details {
        address[] tokenAddrs;
        uint256[] amounts;
    }

    struct ERC721Details {
        address tokenAddr;
        uint256[] ids;
    }

    enum State { Initiated, Waiting_for_offers, Offered, Destroyed }

    struct BoxOffer {
        uint256 boxID;
        bool active;
    }

    struct SwapBox {
        uint256 id;
        address owner;
        ERC721Details[] erc721Tokens;
        ERC20Details erc20Tokens;
        uint256 createdTime;
        State state;
        // this shows the offered ID lists If this box state is waiting
        // this shows the waiting ID lists If this box state is offer
        BoxOffer[] offers;
    }

    mapping(address => bool) private whitelisttokens;
    mapping(uint256 => SwapBox) private swapBoxes;

    event SwapBoxState (
        uint256 swapItemID,
        address owner,
        State state,
        uint256 createdTime,
        uint256 updateTime,
        ERC721Details[] erc721Tokens,
        ERC20Details erc20Tokens
    );

    event SwapBoxCreated (
        uint256 swapItemID,
        ERC721Details[] erc721Tokens,
        ERC20Details erc20Tokens,
        address owner,
        State state
    );

    event Swaped (
        uint256 swapItemID,
        address owner,
        uint256 swapOfferBoxID,
        address offer
    );

    event SwapBoxOffered (
        uint256 waitingBoxID,
        uint256 offerBoxID,
        address offerAddress
    );

    event SwapDeList (
        uint256 waitingBoxID,
        address owner
    );

    event SwapDeOffer (
        uint256 offerBoxID,
        address owner
    );

    constructor() {
        swapOwner = payable(msg.sender);
    }

    /**
     * Check the swap is active
     */
    modifier isOpenForSwap() {
        require(openSwap, "Swap is not allowed");
        _;
    }

    /**
     * Set the Swap state
     */
    function setSwapState(bool _new) external onlyOwner {
        openSwap = _new;
    }

    /**
     * Set the Swap Owner Address
     */
    function setSwapOwner(address swapper) external onlyOwner {
        swapOwner = payable(swapper);
    }

    /**
     * Set SwapContract Fees
     */
    function setSwapPrices(uint256[] memory fees) external onlyOwner {
        swapFees = fees;
    }

    /**
     * Get SwapContract Fees
     */
    function getSwapPrices() public view returns (uint256[] memory) {
        return swapFees;
    }

    /**
     * Add whitelist ERC20 Token
     */
    function addWhiteListToken(address erc20Token) external onlyOwner {
        whitelisttokens[erc20Token] = true;
    }

    /**
     * Destroy All SwapBox
     * Emergency Function
     */
    function destroyAllSwapBox() external onlyOwner {
        uint256 total = _itemCounter.current();
        for (uint256 i = 1; i <= total; i++) {
            swapBoxes[i].state = State.Destroyed;

            _returnAssetsHelper(
                swapBoxes[i].erc721Tokens,
                swapBoxes[i].erc20Tokens,
                address(this),
                swapBoxes[i].owner
            );
        }
    }

    /**
     * WithDraw fees
     */
    function withDraw() external onlyOwner {
        uint balance = address(this).balance;
        swapOwner.transfer(balance);
    }

    /**
     * Checking the assets
     */
    function _checkAssets(
        ERC721Details[] memory erc721Details,
        ERC20Details memory erc20Details,
        address offer
    ) internal view {
        for (uint256 i = 0; i < erc721Details.length; i++) {
            require(erc721Details[i].ids.length > 0, "Non included ERC721 token");

            for (uint256 j = 0; j < erc721Details[i].ids.length; j++) {
                require(IERC721(erc721Details[i].tokenAddr).getApproved(erc721Details[i].ids[j]) == address(this), "ERC721 tokens must be approved to swap contract");
            }
        }

        // check duplicated token address
        for (uint256 i = 0; i < erc20Details.tokenAddrs.length; i++) {
            uint256 tokenCount = 0;
            for (uint256 j = 0; j < erc20Details.tokenAddrs.length; j++) {
                if (erc20Details.tokenAddrs[i] == erc20Details.tokenAddrs[j]) {
                    tokenCount ++;
                }
            }

            require(tokenCount == 1, "Invalid ERC20 tokens");
        }

        for (uint256 i = 0; i < erc20Details.tokenAddrs.length; i++) {
            require(whitelisttokens[erc20Details.tokenAddrs[i]], "Not allowed ERC20 tokens");
            require(IERC20(erc20Details.tokenAddrs[i]).allowance(offer, address(this)) >= erc20Details.amounts[i], "ERC20 tokens must be approved to swap contract");
            require(IERC20(erc20Details.tokenAddrs[i]).balanceOf(offer) >= erc20Details.amounts[i], "Insufficient ERC20 tokens");
        }
    }

    /**
     * Transfer assets to Swap Contract
     */
    function _transferAssetsHelper(
        ERC721Details[] memory erc721Details,
        ERC20Details memory erc20Details,
        address from,
        address to
    ) internal {
        for (uint256 i = 0; i < erc721Details.length; i++) {
            for (uint256 j = 0; j < erc721Details[i].ids.length; j++) {
                IERC721(erc721Details[i].tokenAddr).transferFrom(
                    from,
                    to,
                    erc721Details[i].ids[j]
                );
            }
        }

        for (uint256 i = 0; i < erc20Details.tokenAddrs.length; i++) {
            IERC20(erc20Details.tokenAddrs[i]).transferFrom(from, to, erc20Details.amounts[i]);
        }
    }

    /**
     * Return assets to holders
     * ERC20 requires approve from contract to holder
     */
    function _returnAssetsHelper(
        ERC721Details[] memory erc721Details,
        ERC20Details memory erc20Details,
        address from,
        address to
    ) internal {
        for (uint256 i = 0; i < erc721Details.length; i++) {
            for (uint256 j = 0; j < erc721Details[i].ids.length; j++) {
                IERC721(erc721Details[i].tokenAddr).transferFrom(
                    from,
                    to,
                    erc721Details[i].ids[j]
                );
            }
        }

        for (uint256 i = 0; i < erc20Details.tokenAddrs.length; i++) {
            IERC20(erc20Details.tokenAddrs[i]).transfer(to, erc20Details.amounts[i]);
        }
    }

    /**
     * Checking the exist boxID
     * If checkingActive is true, it will check activity
     */
    function _existBoxID(
        SwapBox memory box,
        uint256 boxID,
        bool checkingActive
    ) internal pure returns (bool){
        for (uint256 i = 0; i < box.offers.length; i++) {
            if (checkingActive) {
                if (checkingActive && box.offers[i].boxID == boxID && box.offers[i].active) {
                    return true;
                }
            } else {
                if (box.offers[i].boxID == boxID) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Insert & Update the SwapOffer to Swap Box
     * Set active value of Swap Offer
     */
    function _putSwapOffer(
        uint256 listID,
        uint256 boxID,
        bool active
    ) internal {
        for (uint256 i = 0; i < swapBoxes[listID].offers.length; i++) {
            if (swapBoxes[listID].offers[i].boxID == boxID) {
                swapBoxes[listID].offers[i].active = active;
                return;
            }
        }

        swapBoxes[listID].offers.push(
            BoxOffer (
                boxID,
                active
            )
        );
    }

    /**
     * Create Swap Box
     * Warning User needs to approve assets before list
     */
    function createBox(
        ERC721Details[] memory erc721Details,
        ERC20Details memory erc20Details
    ) public payable isOpenForSwap nonReentrant {
        require(erc721Details.length > 0, "SwapItems must include ERC721");

        require(msg.value >= swapFees[0], "Insufficient Creating Box Fee");

        _checkAssets(erc721Details, erc20Details, msg.sender);
        _transferAssetsHelper(erc721Details, erc20Details, msg.sender, address(this));

        _itemCounter.increment();
        uint256 id = _itemCounter.current();

        SwapBox storage box = swapBoxes[id];
        box.id = id;
        box.erc20Tokens = erc20Details;
        box.owner = msg.sender;
        box.state = State.Initiated;
        box.createdTime = block.timestamp;
        for (uint256 i = 0; i < erc721Details.length; i++) {
            box.erc721Tokens.push(erc721Details[i]);
        }

        emit SwapBoxState(
            id,
            msg.sender,
            State.Initiated,
            block.timestamp,
            block.timestamp,
            erc721Details,
            erc20Details
        );
    }

    /**
     * Update the Box to Waiting_for_offers state
     */
    function toWaitingForOffers(
        uint256 boxID
    ) public payable isOpenForSwap nonReentrant {
        require(swapBoxes[boxID].owner == msg.sender, "Allowed to only Owner of SwapBox");
        require(swapBoxes[boxID].state == State.Initiated, "Not Allowed Operation");

        require(msg.value >= swapFees[1], "Insufficient Listing Fee");

        swapBoxes[boxID].state = State.Waiting_for_offers;

        emit SwapBoxState(
            boxID,
            msg.sender,
            State.Waiting_for_offers,
            swapBoxes[boxID].createdTime,
            block.timestamp,
            swapBoxes[boxID].erc721Tokens,
            swapBoxes[boxID].erc20Tokens
        );
    }

    /**
     * update the Box to Offer state
     */
    function toOffer(
        uint256 boxID
    ) public payable isOpenForSwap nonReentrant {
        require(swapBoxes[boxID].owner == msg.sender, "Allowed to only Owner of SwapBox");
        require(swapBoxes[boxID].state == State.Initiated, "Not Allowed Operation");

        require(msg.value >= swapFees[2], "Insufficient Offer Fee");

        swapBoxes[boxID].state = State.Offered;

        emit SwapBoxState(
            boxID,
            msg.sender,
            State.Offered,
            swapBoxes[boxID].createdTime,
            block.timestamp,
            swapBoxes[boxID].erc721Tokens,
            swapBoxes[boxID].erc20Tokens
        );
    }

    /**
     * Destroy Box
     * all assets back to owner's wallet
     */
    function destroyBox(
        uint256 boxID
    ) public payable isOpenForSwap nonReentrant {
        require(swapBoxes[boxID].state == State.Initiated, "Not Allowed Operation");
        require(swapBoxes[boxID].owner == msg.sender, "Allowed to only Owner of SwapBox");

        require(msg.value >= swapFees[3], "Insufficient Offer Fee");
        
        swapBoxes[boxID].state = State.Destroyed;

        _returnAssetsHelper(
            swapBoxes[boxID].erc721Tokens,
            swapBoxes[boxID].erc20Tokens,
            address(this),
            msg.sender
        );

        emit SwapBoxState(
            boxID,
            msg.sender,
            State.Offered,
            swapBoxes[boxID].createdTime,
            block.timestamp,
            swapBoxes[boxID].erc721Tokens,
            swapBoxes[boxID].erc20Tokens
        );
    }

    /**
     * Update the box to Initiate State
     * This function is unnecessary now
     */
    function toInitiate(
        uint256 boxID
    ) public isOpenForSwap nonReentrant {
        require(swapBoxes[boxID].owner == msg.sender, "Allowed to only Owner of SwapBox");
        require(swapBoxes[boxID].state != State.Destroyed, "Not Allowed Operation");

        swapBoxes[boxID].state = State.Waiting_for_offers;
        delete swapBoxes[boxID].offers;

        emit SwapBoxState(
            boxID,
            msg.sender,
            State.Initiated,
            swapBoxes[boxID].createdTime,
            block.timestamp,
            swapBoxes[boxID].erc721Tokens,
            swapBoxes[boxID].erc20Tokens
        );
    }

    /**
     * Link your Box to other's waiting Box
     * Equal to offer to other Swap Box
     */
    function linkBox(
        uint256 listBoxID,
        uint256 offerBoxID
    ) public isOpenForSwap nonReentrant {
        require(openSwap, "Swap is not opended");
        require(swapBoxes[offerBoxID].state == State.Initiated || swapBoxes[offerBoxID].state == State.Offered, "Not Allowed Operation");
        require(swapBoxes[offerBoxID].owner == msg.sender, "Allowed to only Owner of SwapBox");

        require(swapBoxes[listBoxID].state == State.Waiting_for_offers, "This Box is not Waiting_for_offer State");

        swapBoxes[offerBoxID].state = State.Offered;
        
        _putSwapOffer(offerBoxID, listBoxID, true);
        _putSwapOffer(listBoxID, offerBoxID, true);

        emit SwapBoxOffered (
            listBoxID,
            offerBoxID,
            msg.sender
        );
    }

    /**
     * Swaping Box
     * Owners of Each Swapbox should be exchanged
     */
    function swapBox(
        uint256 listBoxID,
        uint256 offerBoxID
    ) public isOpenForSwap nonReentrant {
        require(swapBoxes[listBoxID].owner == msg.sender, "Allowed to only Owner of SwapBox");
        require(swapBoxes[listBoxID].state == State.Waiting_for_offers, "Not Allowed Operation");
        require(swapBoxes[offerBoxID].state == State.Offered, "Not offered Swap Box");
        require(_existBoxID(swapBoxes[listBoxID], offerBoxID, true), "This box is not exist or active");

        swapBoxes[listBoxID].owner = swapBoxes[offerBoxID].owner;
        swapBoxes[listBoxID].state = State.Initiated;
        delete swapBoxes[listBoxID].offers;
        
        swapBoxes[offerBoxID].owner = msg.sender;
        swapBoxes[offerBoxID].state = State.Initiated;
        delete swapBoxes[offerBoxID].offers;

        emit Swaped(
            listBoxID,
            msg.sender,
            offerBoxID,
            swapBoxes[listBoxID].owner
        );
    }

    /**
     * Cancel Listing
     * Box's state should be from Waiting_for_Offers to Initiate
     */
    function deListBox(
        uint256 listBoxID
    ) public isOpenForSwap nonReentrant {
        require(swapBoxes[listBoxID].owner == msg.sender, "Allowed to only Owner of SwapBox");
        require(swapBoxes[listBoxID].state == State.Waiting_for_offers, "Not Allowed Operation");

        for(uint256 i = 0; i < swapBoxes[listBoxID].offers.length; i++) {
            if (swapBoxes[listBoxID].offers[i].active && _existBoxID(swapBoxes[swapBoxes[listBoxID].offers[i].boxID], listBoxID, true)) {
                _putSwapOffer(swapBoxes[listBoxID].offers[i].boxID, listBoxID, false);
            }
        }

        swapBoxes[listBoxID].state = State.Initiated;
        delete swapBoxes[listBoxID].offers;
        
        emit SwapDeList(
            listBoxID,
            msg.sender
        );
    }

    /**
     * Cancel Offer
     * Box's state should be from Offered to Initiate
     */
    function deOffer(
        uint256 offerBoxID
    ) public isOpenForSwap nonReentrant {
        require(swapBoxes[offerBoxID].owner == msg.sender, "Allowed to only Owner of SwapBox");
        require(swapBoxes[offerBoxID].state == State.Offered, "Not Allowed Operation");

        for(uint256 i = 0; i < swapBoxes[offerBoxID].offers.length; i++) {
            if (swapBoxes[offerBoxID].offers[i].active && _existBoxID(swapBoxes[swapBoxes[offerBoxID].offers[i].boxID], offerBoxID, true)) {
                _putSwapOffer(swapBoxes[offerBoxID].offers[i].boxID, offerBoxID, false);
            }
        }

        swapBoxes[offerBoxID].state = State.Initiated;
        delete swapBoxes[offerBoxID].offers;

        emit SwapDeOffer(
            offerBoxID,
            msg.sender
        );
    }

    /**
     * Get Specific State Swap Boxed by Specific Wallet Address
     */
    function getOwnedSwapBoxes(
        address boxOwner,
        State state
    ) public view returns (SwapBox[] memory) {
        uint256 total = _itemCounter.current();
        uint itemCount = 0;

        for (uint256 i = 1; i <= total; i++) {
            if (swapBoxes[i].owner == boxOwner && swapBoxes[i].state == state) {
                itemCount++;
            }
        }

        SwapBox[] memory boxes = new SwapBox[](itemCount);
        uint256 itemIndex = 0;

        for (uint256 i = 1; i <= total; i++) {
            if (swapBoxes[i].owner == boxOwner && swapBoxes[i].state == state) {
                boxes[itemIndex] = swapBoxes[i];
                itemIndex++;
            }
        }

        return boxes;
    }

    /**
     * Get offered Boxes to specifix box in Waiting_for_offer
     */
    function getOfferedSwapBoxes(
        uint256 listBoxID
    ) public view returns (SwapBox[] memory) {
        uint itemCount = 0;

        if (swapBoxes[listBoxID].state == State.Waiting_for_offers) {
            for (uint256 i = 0; i < swapBoxes[listBoxID].offers.length; i++) {
                if (swapBoxes[listBoxID].offers[i].active && _existBoxID(swapBoxes[swapBoxes[listBoxID].offers[i].boxID], listBoxID, true)) {
                    itemCount++;
                }
            }
        }

        SwapBox[] memory boxes = new SwapBox[](itemCount);
        uint256 itemIndex = 0;

        for (uint256 i = 0; i < swapBoxes[listBoxID].offers.length; i++) {
            if (swapBoxes[listBoxID].offers[i].active && _existBoxID(swapBoxes[swapBoxes[listBoxID].offers[i].boxID], listBoxID, true)) {
                boxes[itemIndex] = swapBoxes[swapBoxes[listBoxID].offers[i].boxID];
                itemIndex++;
            }
        }
    
        return boxes;
    }

    /**
     * Get waiting Boxes what offered Box link to
     */
    function getWaitingSwapBoxes(
        uint256 offerBoxID
    ) public view returns (SwapBox[] memory) {
        uint itemCount = 0;

        if (swapBoxes[offerBoxID].state == State.Offered) {
            for (uint256 i = 0; i < swapBoxes[offerBoxID].offers.length; i++) {
                if (swapBoxes[offerBoxID].offers[i].active && _existBoxID(swapBoxes[swapBoxes[offerBoxID].offers[i].boxID], offerBoxID, true)) {
                    itemCount++;
                }
            }
        }

        SwapBox[] memory boxes = new SwapBox[](itemCount);
        uint256 itemIndex = 0;

        for (uint256 i = 0; i < swapBoxes[offerBoxID].offers.length; i++) {
            if (swapBoxes[offerBoxID].offers[i].active && _existBoxID(swapBoxes[swapBoxes[offerBoxID].offers[i].boxID], offerBoxID, true)) {
                boxes[itemIndex] = swapBoxes[swapBoxes[offerBoxID].offers[i].boxID];
                itemIndex++;
            }
        }
    
        return boxes;
    }

    /**
     * Get Swap Box by Index
     */
    function getBoxByIndex(
        uint256 listBoxID
    ) public view returns (SwapBox memory) {
        return swapBoxes[listBoxID];
    }

    /**
     * Get specific state of Swap Boxes 
     */
    function getBoxesByState(
        State state
    ) public view returns (SwapBox[] memory) {
        uint256 total = _itemCounter.current();
        uint itemCount = 0;

        for (uint256 i = 1; i <= total; i++) {
            if (swapBoxes[i].state == state) {
                itemCount++;
            }
        }

        SwapBox[] memory boxes = new SwapBox[](itemCount);
        uint256 itemIndex = 0;

        for (uint256 i = 1; i <= total; i++) {
            if (swapBoxes[i].state == state) {
                boxes[itemIndex] = swapBoxes[i];
                itemIndex++;
            }
        }

        return boxes;
    }
}