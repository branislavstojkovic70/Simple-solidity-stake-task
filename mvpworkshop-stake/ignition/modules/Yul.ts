import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";


const YulModule = buildModule("YulModule", (m) => {
  const yul = m.contract("Yul", [], {
  });

  return { yul };
});

export default YulModule;
