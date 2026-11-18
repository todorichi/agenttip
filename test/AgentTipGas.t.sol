// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "../src/AgentTip.sol";

/// @notice Gas measurements only (fork, BSC mainnet, real Agent ID contract).
contract AgentTipGasTest is Test {
    address public constant NYCTO =
        0x0d8C5bEe45EF5816856448A338aA12fE5281Fe9a;
    address public constant LUQIA =
        0xD452E84A2CaF0798aB81e97D8FeCECed144D0aED;

    function testDeployGas() public {
        uint256 g = gasleft();
        AgentTip t = new AgentTip();
        uint256 used = g - gasleft();
        emit log_named_uint("deploy gas", used);
        assert(address(t) != address(0));
    }

    function testTipGas() public {
        AgentTip agentTip = new AgentTip();
        vm.deal(NYCTO, 10 ether);
        vm.prank(NYCTO);
        uint256 g = gasleft();
        agentTip.tip{value: 0.001 ether}(LUQIA, "hello");
        uint256 used = g - gasleft();
        emit log_named_uint("tip gas (0.001 BNB, short msg)", used);
    }

    function testTipGasFirstTipCold() public {
        // First tip to a fresh recipient mapping slot is the most expensive
        // realistic case; covered by testTipGas above (fresh contract).
    }
}
