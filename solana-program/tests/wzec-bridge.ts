import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { WzecBridge } from "../target/types/wzec_bridge";
import { TOKEN_PROGRAM_ID, createMint, getOrCreateAssociatedTokenAccount } from "@solana/spl-token";
import { expect } from "chai";

describe("wzec-bridge", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.WzecBridge as Program<WzecBridge>;
  
  let mint: anchor.web3.PublicKey;
  let bridgeState: anchor.web3.PublicKey;
  let userTokenAccount: anchor.web3.PublicKey;
  
  const authority = provider.wallet.publicKey;
  const user = anchor.web3.Keypair.generate();

  before(async () => {
    // Create token mint
    mint = await createMint(
      provider.connection,
      provider.wallet.payer,
      authority,
      null,
      8 // 8 decimals like ZEC
    );

    // Derive bridge state PDA
    [bridgeState] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("bridge_state")],
      program.programId
    );

    // Airdrop SOL to user for testing
    const airdropSig = await provider.connection.requestAirdrop(
      user.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdropSig);

    // Create token account for user
    const userTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      provider.wallet.payer,
      mint,
      user.publicKey
    );
    userTokenAccount = userTokenAccountInfo.address;
  });

  it("Initializes the bridge", async () => {
    const feePercentage = 10; // 0.1%

    const tx = await program.methods
      .initialize(feePercentage)
      .accounts({
        bridgeState,
        mint,
        authority,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    console.log("Initialize transaction:", tx);

    // Fetch bridge state
    const state = await program.account.bridgeState.fetch(bridgeState);
    
    expect(state.authority.toString()).to.equal(authority.toString());
    expect(state.mint.toString()).to.equal(mint.toString());
    expect(state.feePercentage).to.equal(feePercentage);
    expect(state.paused).to.be.false;
    expect(state.totalMinted.toNumber()).to.equal(0);
    expect(state.totalBurned.toNumber()).to.equal(0);
  });

  it("Mints wZEC tokens", async () => {
    const amount = new anchor.BN(100_000_000); // 1 wZEC
    const zcashTxid = "test_txid_12345";

    const tx = await program.methods
      .mintWzec(amount, zcashTxid)
      .accounts({
        bridgeState,
        mint,
        recipientTokenAccount: userTokenAccount,
        authority,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    console.log("Mint transaction:", tx);

    // Fetch updated bridge state
    const state = await program.account.bridgeState.fetch(bridgeState);
    expect(state.totalMinted.toString()).to.equal(amount.toString());
  });

  it("Burns wZEC tokens", async () => {
    const amount = new anchor.BN(50_000_000); // 0.5 wZEC
    const zecAddress = "ztestsapling1234567890123456789012345678901234567890123456789012345678901234567890";

    const tx = await program.methods
      .burnWzec(amount, zecAddress)
      .accounts({
        bridgeState,
        mint,
        userTokenAccount,
        user: user.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([user])
      .rpc();

    console.log("Burn transaction:", tx);

    // Fetch updated bridge state
    const state = await program.account.bridgeState.fetch(bridgeState);
    expect(state.totalBurned.toNumber()).to.be.greaterThan(0);
  });

  it("Pauses the bridge", async () => {
    const tx = await program.methods
      .pauseBridge()
      .accounts({
        bridgeState,
        authority,
      })
      .rpc();

    console.log("Pause transaction:", tx);

    const state = await program.account.bridgeState.fetch(bridgeState);
    expect(state.paused).to.be.true;
  });

  it("Prevents minting when paused", async () => {
    const amount = new anchor.BN(100_000_000);
    const zcashTxid = "test_txid_paused";

    try {
      await program.methods
        .mintWzec(amount, zcashTxid)
        .accounts({
          bridgeState,
          mint,
          recipientTokenAccount: userTokenAccount,
          authority,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();
      
      expect.fail("Should have thrown an error");
    } catch (error) {
      expect(error.toString()).to.include("BridgePaused");
    }
  });

  it("Resumes the bridge", async () => {
    const tx = await program.methods
      .resumeBridge()
      .accounts({
        bridgeState,
        authority,
      })
      .rpc();

    console.log("Resume transaction:", tx);

    const state = await program.account.bridgeState.fetch(bridgeState);
    expect(state.paused).to.be.false;
  });

  it("Updates authority", async () => {
    const newAuthority = anchor.web3.Keypair.generate().publicKey;

    const tx = await program.methods
      .updateAuthority(newAuthority)
      .accounts({
        bridgeState,
        authority,
      })
      .rpc();

    console.log("Update authority transaction:", tx);

    const state = await program.account.bridgeState.fetch(bridgeState);
    expect(state.authority.toString()).to.equal(newAuthority.toString());
  });
});

