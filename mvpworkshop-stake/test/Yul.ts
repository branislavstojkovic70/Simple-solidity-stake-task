import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import hre from "hardhat";

function packMetadata(
  tokenId: bigint, 
  transferable: boolean, 
  color: number, 
  owner: string
): string {
  const tokenIdHex = tokenId.toString(16).padStart(16, "0");
  const transferableHex = transferable ? "01" : "00";
  const colorHex = color.toString(16).padStart(6, "0");
  const ownerHex = owner.toLowerCase().replace(/^0x/, "").padStart(40, "0");
  return "0x" + tokenIdHex + transferableHex + colorHex + ownerHex;
}

describe("Yul", function () {
  async function deployYulFixture() {
    const Yul = await hre.ethers.getContractFactory("Yul");
    const yul = await Yul.deploy();
    return { yul };
  }

  describe("Deployment", function () {
    it("Should deploy correctly", async function () {
      const { yul } = await loadFixture(deployYulFixture);
      expect(yul.target).to.properAddress;
    });
  });

  describe("getColor", function () {
    it("Should return the correct color for known metadata", async function () {
      const { yul } = await loadFixture(deployYulFixture);

      const owner = "0xd8da6bf26964af9d7eed9e03e53415d37aa96045";
      const metadata = packMetadata(1n, true, 0x8000ff, owner);
      const expectedColor = 0x8000ff;

      const color = await yul.getColor(metadata);
      expect(color).to.equal(expectedColor);
    });

    it("Should return 0 for empty metadata", async function () {
      const { yul } = await loadFixture(deployYulFixture);

      const metadata = "0x" + "00".repeat(32);
      const expectedColor = 0x000000;

      const color = await yul.getColor(metadata);
      expect(color).to.equal(expectedColor);
    });

    it("Should correctly parse different color", async function () {
      const { yul } = await loadFixture(deployYulFixture);

      const owner = "0xabcdef1234567890abcdef1234567890abcdef12";
      const metadata = packMetadata(1n, true, 0x123456, owner);
      const expectedColor = 0x123456;

      const color = await yul.getColor(metadata);
      expect(color).to.equal(expectedColor);
    });
  });
});
