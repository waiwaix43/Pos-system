// backend/src/services/paymentProvider.js

class PaymentProvider {
    /**
     * @param {Object} config - Configuration containing secret keys etc.
     */
    constructor(config) {
        this.config = config;
    }

    /**
     * Create a payment charge/transaction
     * @param {Object} params - amount, currency, return_uri, metadata, etc.
     * @returns {Promise<Object>} Provider specific response normalized
     */
    async createPayment(params) {
        throw new Error("Not implemented");
    }

    /**
     * Create a dynamic QR code for PromptPay
     * @param {Object} params - amount, currency, metadata
     * @returns {Promise<Object>} { transaction_id, qr_data, expires_at, raw_response }
     */
    async createQR(params) {
        throw new Error("Not implemented");
    }

    /**
     * Verify payment status from provider
     * @param {String} transactionId 
     * @returns {Promise<Object>} { status: 'PAID' | 'PENDING' | 'FAILED', amount, currency }
     */
    async getPaymentStatus(transactionId) {
        throw new Error("Not implemented");
    }

    /**
     * Verify webhook signature and payload
     * @param {Object} payload 
     * @param {Object} headers 
     * @returns {Boolean}
     */
    verifyWebhook(payload, headers) {
        throw new Error("Not implemented");
    }
}

module.exports = PaymentProvider;
