-- Personal referral code behind the shareable link (?ref=CODE); minted on first use.
ALTER TABLE users ADD COLUMN referral_code TEXT;
CREATE UNIQUE INDEX users_referral_code_key ON users(referral_code);
