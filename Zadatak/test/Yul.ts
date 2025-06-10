import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import hre from "hardhat";

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

      const metadata = "0x0000000000000001018000ffd8da6bf26964af9d7eed9e03e53415d37aa96045"; 
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

      const metadata = "0x0000000000000001abcdef1234567890abcdef1234567890abcdef1234567890";
      const expectedColor = 0x123456; 

      const color = await yul.getColor(metadata);

      expect(color).to.equal(expectedColor);
    });
  });
});
