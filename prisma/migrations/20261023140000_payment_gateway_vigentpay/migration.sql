-- Vigent's own card-to-card gateway takes over the rial checkout from ZarinPay.
ALTER TYPE "PaymentGateway" ADD VALUE IF NOT EXISTS 'VIGENTPAY';
