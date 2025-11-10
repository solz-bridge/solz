use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn, Mint, MintTo, Token, TokenAccount};

declare_id!("8vZ9qKQZc8kqGmvXZ8VqKDxP8vZ9qKQZc8kqGmvXZ8Vq");

#[program]
pub mod wzec_bridge {
    use super::*;

    /// Initialize the bridge with token mint and authority
    pub fn initialize(ctx: Context<Initialize>, fee_percentage: u16) -> Result<()> {
        let bridge_state = &mut ctx.accounts.bridge_state;
        bridge_state.authority = ctx.accounts.authority.key();
        bridge_state.mint = ctx.accounts.mint.key();
        bridge_state.fee_percentage = fee_percentage;
        bridge_state.paused = false;
        bridge_state.total_minted = 0;
        bridge_state.total_burned = 0;
        bridge_state.fee_collected = 0;

        msg!("Bridge initialized with authority: {}", bridge_state.authority);
        msg!("Mint address: {}", bridge_state.mint);
        msg!("Fee percentage: {}%", fee_percentage as f64 / 100.0);

        Ok(())
    }

    /// Mint wZEC tokens (bridge authority only)
    pub fn mint_wzec(
        ctx: Context<MintWZEC>,
        amount: u64,
        zcash_txid: String,
    ) -> Result<()> {
        let bridge_state = &mut ctx.accounts.bridge_state;

        // Check if bridge is paused
        require!(!bridge_state.paused, BridgeError::BridgePaused);

        // Verify authority
        require!(
            ctx.accounts.authority.key() == bridge_state.authority,
            BridgeError::Unauthorized
        );

        // Validate amount
        require!(amount > 0, BridgeError::InvalidAmount);

        // Mint tokens to recipient
        let cpi_accounts = MintTo {
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.recipient_token_account.to_account_info(),
            authority: ctx.accounts.authority.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token::mint_to(cpi_ctx, amount)?;

        // Update state
        bridge_state.total_minted = bridge_state
            .total_minted
            .checked_add(amount)
            .ok_or(BridgeError::Overflow)?;

        msg!("Minted {} wZEC to {}", amount, ctx.accounts.recipient_token_account.key());
        msg!("Zcash TXID: {}", zcash_txid);

        Ok(())
    }

    /// Burn wZEC tokens and emit withdrawal event
    pub fn burn_wzec(
        ctx: Context<BurnWZEC>,
        amount: u64,
        zec_address: String,
    ) -> Result<()> {
        let bridge_state = &mut ctx.accounts.bridge_state;

        // Check if bridge is paused
        require!(!bridge_state.paused, BridgeError::BridgePaused);

        // Validate amount
        require!(amount > 0, BridgeError::InvalidAmount);

        // Validate ZEC address format (basic check for testnet shielded address)
        require!(
            zec_address.starts_with("ztestsapling1") && zec_address.len() >= 78,
            BridgeError::InvalidZecAddress
        );

        // Calculate fee
        let fee = amount
            .checked_mul(bridge_state.fee_percentage as u64)
            .ok_or(BridgeError::Overflow)?
            .checked_div(10000)
            .ok_or(BridgeError::Overflow)?;

        let amount_after_fee = amount
            .checked_sub(fee)
            .ok_or(BridgeError::Overflow)?;

        // Burn tokens from user
        let cpi_accounts = Burn {
            mint: ctx.accounts.mint.to_account_info(),
            from: ctx.accounts.user_token_account.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token::burn(cpi_ctx, amount)?;

        // Update state
        bridge_state.total_burned = bridge_state
            .total_burned
            .checked_add(amount)
            .ok_or(BridgeError::Overflow)?;

        bridge_state.fee_collected = bridge_state
            .fee_collected
            .checked_add(fee)
            .ok_or(BridgeError::Overflow)?;

        msg!("Burned {} wZEC from {}", amount, ctx.accounts.user.key());
        msg!("ZEC destination: {}", zec_address);
        msg!("Amount after fee: {}", amount_after_fee);
        msg!("Fee collected: {}", fee);

        Ok(())
    }

    /// Update bridge authority (admin only)
    pub fn update_authority(ctx: Context<UpdateAuthority>, new_authority: Pubkey) -> Result<()> {
        let bridge_state = &mut ctx.accounts.bridge_state;

        // Verify current authority
        require!(
            ctx.accounts.authority.key() == bridge_state.authority,
            BridgeError::Unauthorized
        );

        let old_authority = bridge_state.authority;
        bridge_state.authority = new_authority;

        msg!("Authority updated from {} to {}", old_authority, new_authority);

        Ok(())
    }

    /// Pause bridge operations (admin only)
    pub fn pause_bridge(ctx: Context<PauseBridge>) -> Result<()> {
        let bridge_state = &mut ctx.accounts.bridge_state;

        // Verify authority
        require!(
            ctx.accounts.authority.key() == bridge_state.authority,
            BridgeError::Unauthorized
        );

        bridge_state.paused = true;

        msg!("Bridge paused by {}", ctx.accounts.authority.key());

        Ok(())
    }

    /// Resume bridge operations (admin only)
    pub fn resume_bridge(ctx: Context<ResumeBridge>) -> Result<()> {
        let bridge_state = &mut ctx.accounts.bridge_state;

        // Verify authority
        require!(
            ctx.accounts.authority.key() == bridge_state.authority,
            BridgeError::Unauthorized
        );

        bridge_state.paused = false;

        msg!("Bridge resumed by {}", ctx.accounts.authority.key());

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + BridgeState::LEN,
        seeds = [b"bridge_state"],
        bump
    )]
    pub bridge_state: Account<'info, BridgeState>,
    
    #[account(mut)]
    pub mint: Account<'info, Mint>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct MintWZEC<'info> {
    #[account(
        mut,
        seeds = [b"bridge_state"],
        bump
    )]
    pub bridge_state: Account<'info, BridgeState>,
    
    #[account(mut)]
    pub mint: Account<'info, Mint>,
    
    #[account(mut)]
    pub recipient_token_account: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct BurnWZEC<'info> {
    #[account(
        mut,
        seeds = [b"bridge_state"],
        bump
    )]
    pub bridge_state: Account<'info, BridgeState>,
    
    #[account(mut)]
    pub mint: Account<'info, Mint>,
    
    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub user: Signer<'info>,
    
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct UpdateAuthority<'info> {
    #[account(
        mut,
        seeds = [b"bridge_state"],
        bump
    )]
    pub bridge_state: Account<'info, BridgeState>,
    
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct PauseBridge<'info> {
    #[account(
        mut,
        seeds = [b"bridge_state"],
        bump
    )]
    pub bridge_state: Account<'info, BridgeState>,
    
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct ResumeBridge<'info> {
    #[account(
        mut,
        seeds = [b"bridge_state"],
        bump
    )]
    pub bridge_state: Account<'info, BridgeState>,
    
    pub authority: Signer<'info>,
}

#[account]
pub struct BridgeState {
    pub authority: Pubkey,
    pub mint: Pubkey,
    pub fee_percentage: u16,  // Basis points (10 = 0.1%)
    pub paused: bool,
    pub total_minted: u64,
    pub total_burned: u64,
    pub fee_collected: u64,
}

impl BridgeState {
    pub const LEN: usize = 32 + 32 + 2 + 1 + 8 + 8 + 8;
}

#[error_code]
pub enum BridgeError {
    #[msg("Bridge is currently paused")]
    BridgePaused,
    
    #[msg("Unauthorized: Only bridge authority can perform this action")]
    Unauthorized,
    
    #[msg("Invalid amount: Must be greater than 0")]
    InvalidAmount,
    
    #[msg("Invalid ZEC address format")]
    InvalidZecAddress,
    
    #[msg("Arithmetic overflow")]
    Overflow,
}

