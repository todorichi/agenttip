// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title AgentTip — tip any Agent ID holder by name (BNB)
/// @notice Ownerless by design: no admin, no owner, no custody, no fees,
///         no upgradeability. Tips forward to the recipient immediately.
/// @dev Both tipper and recipient must hold a Binance Agent ID
///      (SPACE ID Agent ID, ERC-721, 0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F).
interface IAgentID {
    function balanceOf(address account) external view returns (uint256);
}

contract AgentTip {
    IAgentID public constant AGENT_ID =
        IAgentID(0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F);

    /// @notice Minimum tip: 0.0001 BNB.
    uint256 public constant MIN_TIP = 0.0001 ether;
    /// @notice Maximum message length in bytes.
    uint256 public constant MAX_MESSAGE_LENGTH = 140;

    /// @notice Total BNB received as tips, per address.
    mapping(address => uint256) public totalReceived;
    /// @notice Total BNB sent as tips, per address.
    mapping(address => uint256) public totalSent;
    /// @notice Number of tips received, per address.
    mapping(address => uint256) public tipCount;

    event Tip(
        address indexed tipper,
        address indexed recipient,
        uint256 amount,
        string message,
        uint256 timestamp
    );

    error NotAgentIDHolder(address account);
    error SelfTip();
    error TipTooSmall(uint256 amount, uint256 minimum);
    error MessageTooLong(uint256 length, uint256 maximum);
    error TransferFailed();

    /// @notice Tip an Agent ID holder. The full amount is forwarded immediately.
    /// @param recipient The address receiving the tip. Must hold an Agent ID.
    /// @param message Optional message, max 140 bytes.
    function tip(address recipient, string calldata message) external payable {
        if (AGENT_ID.balanceOf(msg.sender) == 0) {
            revert NotAgentIDHolder(msg.sender);
        }
        if (AGENT_ID.balanceOf(recipient) == 0) {
            revert NotAgentIDHolder(recipient);
        }
        if (recipient == msg.sender) revert SelfTip();
        if (msg.value < MIN_TIP) revert TipTooSmall(msg.value, MIN_TIP);
        if (bytes(message).length > MAX_MESSAGE_LENGTH) {
            revert MessageTooLong(bytes(message).length, MAX_MESSAGE_LENGTH);
        }

        totalReceived[recipient] += msg.value;
        totalSent[msg.sender] += msg.value;
        tipCount[recipient] += 1;

        emit Tip(msg.sender, recipient, msg.value, message, block.timestamp);

        (bool ok, ) = recipient.call{value: msg.value}("");
        if (!ok) revert TransferFailed();
    }

    /// @notice Stats for one address: (received, sent, tips received).
    function getStats(
        address account
    ) external view returns (uint256 received, uint256 sent, uint256 tips) {
        return (totalReceived[account], totalSent[account], tipCount[account]);
    }
}
