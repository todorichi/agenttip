// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "../src/AgentTip.sol";

/// @notice Fork tests against BSC mainnet, using the REAL Agent ID contract.
/// @dev Run: forge test --fork-url https://bsc-dataseed1.binance.org -vv
contract AgentTipTest is Test {
    AgentTip public agentTip;

    // Real Agent ID holders (verified on-chain, balanceOf == 1).
    address public constant NYCTO = 0x0d8C5bEe45EF5816856448A338aA12fE5281Fe9a;
    address public constant LUQIA = 0xD452E84A2CaF0798aB81e97D8FeCECed144D0aED;
    // Fresh address with no Agent ID.
    address public constant NOBODY = 0x000000000000000000000000000000000000dEaD;

    event Tip(
        address indexed tipper,
        address indexed recipient,
        uint256 amount,
        string message,
        uint256 timestamp
    );

    function setUp() public {
        agentTip = new AgentTip();
        vm.deal(NYCTO, 10 ether);
        vm.deal(LUQIA, 10 ether);
    }

    function testSuccess() public {
        uint256 luqiaBefore = LUQIA.balance;
        vm.prank(NYCTO);
        vm.expectEmit(true, true, false, true, address(agentTip));
        emit Tip(NYCTO, LUQIA, 0.001 ether, "great work!", block.timestamp);
        agentTip.tip{value: 0.001 ether}(LUQIA, "great work!");

        assertEq(LUQIA.balance, luqiaBefore + 0.001 ether);
        assertEq(agentTip.totalReceived(LUQIA), 0.001 ether);
        assertEq(agentTip.totalSent(NYCTO), 0.001 ether);
        assertEq(agentTip.tipCount(LUQIA), 1);
        // Contract holds nothing: full amount forwarded immediately.
        assertEq(address(agentTip).balance, 0);
        (uint256 r, uint256 s, uint256 t) = agentTip.getStats(LUQIA);
        assertEq(r, 0.001 ether);
        assertEq(s, 0);
        assertEq(t, 1);
    }

    function testMinTipBoundary() public {
        vm.prank(NYCTO);
        agentTip.tip{value: 0.0001 ether}(LUQIA, "");
        assertEq(agentTip.totalReceived(LUQIA), 0.0001 ether);
    }

    function testMaxMessageBoundary() public {
        string memory m140 = string(new bytes(140));
        vm.prank(NYCTO);
        agentTip.tip{value: 0.001 ether}(LUQIA, m140);
        assertEq(agentTip.tipCount(LUQIA), 1);
    }

    function testRevertNonHolderTipper() public {
        vm.deal(NOBODY, 1 ether);
        vm.prank(NOBODY);
        vm.expectRevert(
            abi.encodeWithSelector(AgentTip.NotAgentIDHolder.selector, NOBODY)
        );
        agentTip.tip{value: 0.001 ether}(LUQIA, "hi");
    }

    function testRevertNonHolderRecipient() public {
        vm.prank(NYCTO);
        vm.expectRevert(
            abi.encodeWithSelector(AgentTip.NotAgentIDHolder.selector, NOBODY)
        );
        agentTip.tip{value: 0.001 ether}(NOBODY, "hi");
    }

    function testRevertSelfTip() public {
        vm.prank(NYCTO);
        vm.expectRevert(AgentTip.SelfTip.selector);
        agentTip.tip{value: 0.001 ether}(NYCTO, "hi");
    }

    function testRevertLowValue() public {
        vm.prank(NYCTO);
        vm.expectRevert(
            abi.encodeWithSelector(
                AgentTip.TipTooSmall.selector,
                0.00009 ether,
                0.0001 ether
            )
        );
        agentTip.tip{value: 0.00009 ether}(LUQIA, "hi");
    }

    function testRevertZeroValue() public {
        vm.prank(NYCTO);
        vm.expectRevert(
            abi.encodeWithSelector(
                AgentTip.TipTooSmall.selector,
                0,
                0.0001 ether
            )
        );
        agentTip.tip{value: 0}(LUQIA, "hi");
    }

    function testRevertLongMessage() public {
        string memory m141 = string(new bytes(141));
        vm.prank(NYCTO);
        vm.expectRevert(
            abi.encodeWithSelector(
                AgentTip.MessageTooLong.selector,
                141,
                140
            )
        );
        agentTip.tip{value: 0.001 ether}(LUQIA, m141);
    }

    function testSecondTipAccumulates() public {
        vm.prank(NYCTO);
        agentTip.tip{value: 0.002 ether}(LUQIA, "one");
        vm.prank(LUQIA);
        agentTip.tip{value: 0.0005 ether}(NYCTO, "back");
        assertEq(agentTip.totalReceived(LUQIA), 0.002 ether);
        assertEq(agentTip.totalSent(LUQIA), 0.0005 ether);
        assertEq(agentTip.totalReceived(NYCTO), 0.0005 ether);
        assertEq(agentTip.tipCount(NYCTO), 1);
        assertEq(agentTip.tipCount(LUQIA), 1);
    }
}
