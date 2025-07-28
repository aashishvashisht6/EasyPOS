<template>
    <div class="checkout-container">
        <!-- Simplified Checkout Header -->
        <div class="checkout-header">
            <div class="header-content">
                <div class="header-icon">
                    <i class="fas fa-shopping-cart"></i>
                </div>
                <div class="header-text">
                    <h2 class="title">Checkout</h2>
                </div>
            </div>
        </div>

        <div class="checkout-content">
            <!-- Customer Selection with Enhanced UI -->
            <div class="section-card customer-section">
                <div class="card-header">
                    <div class="header-icon-small">
                        <i class="fas fa-user"></i>
                    </div>
                    <h3>Customer Information</h3>
                </div>
                <div class="card-content">
                    <Customer />
                </div>
            </div>

            <!-- Cart Items with Better Layout -->
            <div class="section-card cart-section">
                <div class="card-header">
                    <div class="header-icon-small">
                        <i class="fas fa-list"></i>
                    </div>
                    <h3>Order Items</h3>
                    <div class="item-count">{{ cartItems.length }}</div>
                </div>
                <div class="card-content">
                    <CartItems :cartItems="cartItems" />
                </div>
            </div>

            <!-- Apply Discount Section -->
            <div class="section-card discount-section">
                <div class="card-header">
                    <div class="header-icon-small discount-icon">
                        <i class="fas fa-percentage"></i>
                    </div>
                    <h3>Apply Discount</h3>
                </div>
                <div class="card-content">
                    <div class="discount-input-group">
                        <div class="input-with-icon">
                            <input type="number" class="form-input discount-input" placeholder="Enter discount value"
                                v-model="discount" min="0" :max="discountType === 'percent' ? 100 : subtotal">
                            <div class="input-suffix">
                                <select class="discount-type-select" v-model="discountType">
                                    <option value="amount">₹</option>
                                    <option value="percent">%</option>
                                </select>
                            </div>
                        </div>
                        <div class="discount-preview" v-if="discount > 0">
                            <span class="discount-text">Discount: -₹{{ Number(discountAmount).toFixed(2) }}</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Payment Methods Section -->
            <div class="section-card payment-section">
                <div class="card-header">
                    <div class="header-icon-small payment-icon">
                        <i class="fas fa-credit-card"></i>
                    </div>
                    <h3>Payment Methods</h3>
                    <button class="add-payment-btn" @click="addPaymentMethod" title="Add payment method">
                        <i class="fas fa-plus"></i>
                    </button>
                </div>
                <div class="card-content">
                    <div class="payment-methods-list">
                        <div v-for="(payment, index) in paymentMethods" :key="index" class="payment-method-item">
                            <div class="payment-method-content">
                                <div class="payment-select-wrapper">
                                    <select class="payment-method-select" v-model="payment.method">
                                        <option value="cash">💵 Cash</option>
                                        <option value="card">💳 Card</option>
                                        <option value="upi">📱 UPI</option>
                                        <option value="wallet">👛 Wallet</option>
                                    </select>
                                </div>
                                <div class="payment-amount-wrapper">
                                    <div class="input-with-prefix">
                                        <span class="input-prefix">₹</span>
                                        <input type="number" class="payment-amount-input" placeholder="0.00"
                                            v-model="payment.amount" min="0" @input="calculateBalance">
                                    </div>
                                </div>
                                <button class="remove-payment-btn" @click="removePaymentMethod(index)"
                                    v-if="paymentMethods.length > 1" title="Remove payment method">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                    <div class="quick-payment-options" v-if="balance < 0">
                        <p class="quick-payment-label">Quick pay remaining:</p>
                        <div class="quick-payment-buttons">
                            <button class="quick-pay-btn" @click="quickPay('cash')" title="Pay remaining with cash">
                                💵 Cash ₹{{ Math.abs(balance).toFixed(2) }}
                            </button>
                            <button class="quick-pay-btn" @click="quickPay('card')" title="Pay remaining with card">
                                💳 Card ₹{{ Math.abs(balance).toFixed(2) }}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Enhanced Order Summary -->
            <div class="section-card summary-section">
                <div class="card-header">
                    <div class="header-icon-small summary-icon">
                        <i class="fas fa-calculator"></i>
                    </div>
                    <h3>Order Summary</h3>
                </div>
                <div class="card-content">
                    <div class="summary-details">
                        <div class="summary-line">
                            <span class="summary-label">Subtotal</span>
                            <span class="summary-value">₹{{ Number(subtotal).toFixed(2) }}</span>
                        </div>
                        <div class="summary-line discount-line" v-if="discountAmount > 0">
                            <span class="summary-label">Discount</span>
                            <span class="summary-value discount-value">-₹{{ Number(discountAmount).toFixed(2) }}</span>
                        </div>
                        <div class="summary-line">
                            <span class="summary-label">Tax (18%)</span>
                            <span class="summary-value">₹{{ Number(taxAmount).toFixed(2) }}</span>
                        </div>
                        <div class="summary-divider"></div>
                        <div class="summary-line total-line">
                            <span class="summary-label">Total Amount</span>
                            <span class="summary-value total-value">₹{{ Number(total).toFixed(2) }}</span>
                        </div>
                        <div class="payment-status">
                            <div class="summary-line">
                                <span class="summary-label">Amount Paid</span>
                                <span class="summary-value paid-value">₹{{ Number(totalPaid).toFixed(2) }}</span>
                            </div>
                            <div class="summary-line balance-line"
                                :class="balance >= 0 ? 'positive-balance' : 'negative-balance'">
                                <span class="summary-label">{{ balance >= 0 ? 'Change Due' : 'Balance Due' }}</span>
                                <span class="summary-value balance-value">₹{{ Math.abs(balance).toFixed(2) }}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Enhanced Action Buttons -->
            <div class="action-section">
                <button class="primary-action-btn" @click="submitOrder"
                    :disabled="cartItems.length === 0 || balance < 0"
                    :class="{ 'disabled': cartItems.length === 0 || balance < 0 }">
                    <div class="btn-content">
                        <i class="fas fa-check"></i>
                        <span>{{ getSubmitButtonText() }}</span>
                    </div>
                </button>

                <div class="secondary-actions">
                    <button class="secondary-action-btn print-btn" @click="printOrder">
                        <i class="fas fa-print"></i>
                        <span>Print Receipt</span>
                    </button>
                    <button class="secondary-action-btn reset-btn" @click="clearCart">
                        <i class="fas fa-refresh"></i>
                        <span>Start Over</span>
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import Customer from "./Customer.vue";
import CartItems from "./CartItems.vue";

export default {
    name: "Checkout",
    components: {
        Customer,
        CartItems
    },
    props: {
        cartItems: {
            type: Array,
            default: () => []
        },
    },
    data() {
        return {
            customerSearch: '',
            customers: [],
            selectedCustomer: null,
            discount: 0,
            discountType: 'amount',
            paymentMethods: [{ method: 'cash', amount: 0 }],
            subtotal: 0,
            taxRate: 0.18,
            taxAmount: 0,
            total: 0,
            totalPaid: 0,
            balance: 0,
        };
    },
    computed: {
        discountAmount() {
            if (this.discountType === 'percent') {
                return (this.subtotal * this.discount) / 100;
            }
            return this.discount;
        }
    },
    watch: {
        cartItems: {
            handler() {
                this.calculateTotals();
            },
            deep: true,
            immediate: true
        },
        discount() {
            this.calculateTotals();
        },
        discountType() {
            this.calculateTotals();
        }
    },
    methods: {
        calculateTotals() {
            this.subtotal = this.cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            const discountedSubtotal = this.subtotal - this.discountAmount;
            this.taxAmount = discountedSubtotal * this.taxRate;
            this.total = discountedSubtotal + this.taxAmount;
            this.calculateBalance();
        },
        calculateBalance() {
            this.totalPaid = this.paymentMethods.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
            this.balance = this.totalPaid - this.total;
        },
        addPaymentMethod() {
            this.paymentMethods.push({ method: 'cash', amount: 0 });
        },
        removePaymentMethod(index) {
            if (this.paymentMethods.length > 1) {
                this.paymentMethods.splice(index, 1);
                this.calculateBalance();
            }
        },
        quickPay(method) {
            const remainingAmount = Math.abs(this.balance);
            this.paymentMethods.push({ method, amount: remainingAmount });
            this.calculateBalance();
        },
        getSubmitButtonText() {
            if (this.cartItems.length === 0) return 'Cart is Empty';
            if (this.balance < 0) return `Pay ₹${Math.abs(this.balance).toFixed(2)} More`;
            return 'Complete Order';
        },
        submitOrder() {
            if (this.cartItems.length > 0 && this.balance >= 0) {
                // Emit event or handle order submission
                this.$emit('order-submitted', {
                    items: this.cartItems,
                    total: this.total,
                    payments: this.paymentMethods,
                    customer: this.selectedCustomer
                });
            }
        },
        printOrder() {
            // Handle print functionality
            this.$emit('print-order');
        },
        clearCart() {
            // Handle cart clearing
            this.$emit('clear-cart');
            this.paymentMethods = [{ method: 'cash', amount: 0 }];
            this.discount = 0;
        }
    }
};
</script>

<style scoped>
.checkout-container {
    min-height: 100vh;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    padding: 1rem;
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

.checkout-header {
    background: white;
    border-radius: 16px;
    padding: 2rem;
    margin-bottom: 2rem;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}

.header-content {
    display: flex;
    align-items: center;
    margin-bottom: 2rem;
}

.header-icon {
    width: 60px;
    height: 60px;
    background: linear-gradient(135deg, #667eea, #764ba2);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-right: 1rem;
    color: white;
    font-size: 1.5rem;
}

.header-text .title {
    margin: 0;
    font-size: 2rem;
    font-weight: 700;
    color: #2d3748;
}

.header-text .subtitle {
    margin: 0;
    color: #718096;
    font-size: 1rem;
}

.progress-steps {
    display: flex;
    align-items: center;
    justify-content: center;
}

.step {
    display: flex;
    flex-direction: column;
    align-items: center;
    opacity: 0.4;
    transition: opacity 0.3s ease;
}

.step.active {
    opacity: 1;
}

.step-circle {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: #e2e8f0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    margin-bottom: 0.5rem;
    transition: all 0.3s ease;
}

.step.active .step-circle {
    background: linear-gradient(135deg, #667eea, #764ba2);
    color: white;
}

.step-line {
    width: 80px;
    height: 2px;
    background: #e2e8f0;
    margin: 0 1rem;
}

.checkout-content {
    max-width: 1200px;
    margin: 0 auto;
}

.section-card {
    background: white;
    border-radius: 16px;
    margin-bottom: 1.5rem;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.06);
    overflow: hidden;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.section-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
}

.card-header {
    padding: 1.5rem;
    border-bottom: 1px solid #e2e8f0;
    display: flex;
    align-items: center;
    background: #f8fafc;
}

.header-icon-small {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-right: 1rem;
    color: white;
    font-size: 1rem;
}

.customer-section .header-icon-small {
    background: linear-gradient(135deg, #4299e1, #3182ce);
}

.cart-section .header-icon-small {
    background: linear-gradient(135deg, #48bb78, #38a169);
}

.discount-section .header-icon-small {
    background: linear-gradient(135deg, #ed8936, #dd6b20);
}

.payment-section .header-icon-small {
    background: linear-gradient(135deg, #9f7aea, #805ad5);
}

.summary-section .header-icon-small {
    background: linear-gradient(135deg, #38b2ac, #319795);
}

.card-header h3 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: #2d3748;
    flex: 1;
}

.item-count {
    background: #667eea;
    color: white;
    padding: 0.25rem 0.75rem;
    border-radius: 20px;
    font-size: 0.875rem;
    font-weight: 600;
}

.add-payment-btn {
    background: #667eea;
    color: white;
    border: none;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s ease;
}

.add-payment-btn:hover {
    background: #5a67d8;
    transform: scale(1.05);
}

.card-content {
    padding: 1.5rem;
}

.payment-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.5rem;
}

@media (max-width: 768px) {
    .payment-grid {
        grid-template-columns: 1fr;
    }
}

.discount-input-group {
    space-y: 1rem;
}

.input-with-icon {
    display: flex;
    border: 2px solid #e2e8f0;
    border-radius: 12px;
    overflow: hidden;
    transition: border-color 0.2s ease;
}

.input-with-icon:focus-within {
    border-color: #667eea;
}

.discount-input {
    flex: 1;
    padding: 1rem;
    border: none;
    outline: none;
    font-size: 1rem;
}

.input-suffix {
    display: flex;
    align-items: center;
}

.discount-type-select {
    padding: 1rem;
    border: none;
    background: #f8fafc;
    outline: none;
    font-size: 1rem;
    cursor: pointer;
}

.discount-preview {
    margin-top: 0.75rem;
    padding: 0.75rem;
    background: #fef5e7;
    border: 1px solid #f6ad55;
    border-radius: 8px;
}

.discount-text {
    color: #c05621;
    font-weight: 600;
}

.payment-methods-list {
    space-y: 1rem;
}

.payment-method-item {
    background: #f8fafc;
    border-radius: 12px;
    padding: 1rem;
    margin-bottom: 1rem;
}

.payment-method-content {
    display: flex;
    align-items: center;
    gap: 1rem;
}

.payment-select-wrapper {
    flex: 2;
}

.payment-method-select {
    width: 100%;
    padding: 0.75rem;
    border: 2px solid #e2e8f0;
    border-radius: 8px;
    font-size: 1rem;
    outline: none;
    transition: border-color 0.2s ease;
}

.payment-method-select:focus {
    border-color: #667eea;
}

.payment-amount-wrapper {
    flex: 1;
}

.input-with-prefix {
    display: flex;
    border: 2px solid #e2e8f0;
    border-radius: 8px;
    overflow: hidden;
    transition: border-color 0.2s ease;
}

.input-with-prefix:focus-within {
    border-color: #667eea;
}

.input-prefix {
    background: #f8fafc;
    padding: 0.75rem;
    display: flex;
    align-items: center;
    font-weight: 600;
    color: #4a5568;
}

.payment-amount-input {
    flex: 1;
    padding: 0.75rem;
    border: none;
    outline: none;
    font-size: 1rem;
}

.remove-payment-btn {
    background: #fed7d7;
    color: #e53e3e;
    border: none;
    width: 36px;
    height: 36px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s ease;
}

.remove-payment-btn:hover {
    background: #feb2b2;
    transform: scale(1.05);
}

.quick-payment-options {
    margin-top: 1rem;
    padding: 1rem;
    background: #edf2f7;
    border-radius: 8px;
}

.quick-payment-label {
    margin: 0 0 0.75rem 0;
    font-weight: 600;
    color: #4a5568;
    font-size: 0.875rem;
}

.quick-payment-buttons {
    display: flex;
    gap: 0.5rem;
}

.quick-pay-btn {
    background: #667eea;
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 6px;
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.2s ease;
}

.quick-pay-btn:hover {
    background: #5a67d8;
    transform: translateY(-1px);
}

.summary-details {
    space-y: 0.75rem;
}

.summary-line {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 0;
}

.summary-label {
    color: #4a5568;
    font-weight: 500;
}

.summary-value {
    font-weight: 600;
    color: #2d3748;
}

.discount-line .summary-value {
    color: #e53e3e;
}

.summary-divider {
    height: 1px;
    background: #e2e8f0;
    margin: 1rem 0;
}

.total-line {
    background: #f8fafc;
    padding: 1rem;
    border-radius: 8px;
    margin: 1rem 0;
}

.total-line .summary-label {
    font-size: 1.125rem;
    font-weight: 600;
    color: #2d3748;
}

.total-value {
    font-size: 1.5rem;
    font-weight: 700;
    color: #2d3748;
}

.payment-status {
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid #e2e8f0;
}

.positive-balance .balance-value {
    color: #38a169;
}

.negative-balance .balance-value {
    color: #e53e3e;
}

.action-section {
    margin-top: 2rem;
}

.primary-action-btn {
    width: 100%;
    background: linear-gradient(135deg, #667eea, #764ba2);
    color: white;
    border: none;
    padding: 1.25rem;
    border-radius: 12px;
    font-size: 1.125rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    margin-bottom: 1rem;
    box-shadow: 0 4px 16px rgba(102, 126, 234, 0.3);
}

.primary-action-btn:hover:not(.disabled) {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(102, 126, 234, 0.4);
}

.primary-action-btn.disabled {
    background: #a0aec0;
    cursor: not-allowed;
    box-shadow: none;
}

.btn-content {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
}

.secondary-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
}

.secondary-action-btn {
    background: white;
    border: 2px solid #e2e8f0;
    padding: 1rem;
    border-radius: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
}

.secondary-action-btn:hover {
    border-color: #667eea;
    color: #667eea;
    transform: translateY(-1px);
}

.print-btn:hover {
    border-color: #38a169;
    color: #38a169;
}

.reset-btn:hover {
    border-color: #e53e3e;
    color: #e53e3e;
}

@media (max-width: 768px) {
    .checkout-container {
        padding: 0.5rem;
    }

    .checkout-header {
        padding: 1.5rem;
    }

    .header-content {
        flex-direction: column;
        text-align: center;
        margin-bottom: 1.5rem;
    }

    .header-icon {
        margin-right: 0;
        margin-bottom: 1rem;
    }

    .progress-steps {
        flex-wrap: wrap;
        gap: 0.5rem;
    }

    .step-line {
        width: 40px;
    }

    .payment-method-content {
        flex-direction: column;
        gap: 0.75rem;
    }

    .secondary-actions {
        grid-template-columns: 1fr;
    }
}
</style>