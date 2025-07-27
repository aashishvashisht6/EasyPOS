<template>
    <div class="p-4">
        <h5 class="section-title text-dark">
            <i class="fas fa-shopping-cart me-2" style="color: #667eea;"></i>
            Checkout
        </h5>

        <!-- Customer Selection -->
        <div class="checkout-card">
            <Customer/>
        </div>

        <!-- Cart Items -->
        <div class="checkout-card">
            <CartItems :cartItems="cartItems"/>
        </div>

        <!-- Discount Section -->
        <div class="checkout-card">
            <div class="checkout-card-header">
                <i class="fas fa-percentage me-2"></i>
                Discount
            </div>
            <div class="card-body">
                <div class="row g-2">
                    <div class="col-8">
                        <input type="number" class="form-control payment-input" placeholder="Enter discount" v-model="discount" min="0" :max="subtotal">
                    </div>
                    <div class="col-4">
                        <select class="form-select payment-select" v-model="discountType">
                            <option value="amount">₹</option>
                            <option value="percent">%</option>
                        </select>
                    </div>
                </div>
            </div>
        </div>

        <!-- Payment Methods -->
        <div class="checkout-card">
            <div class="checkout-card-header d-flex justify-content-between align-items-center">
                <span>
                    <i class="fas fa-credit-card me-2"></i>
                    Payment Methods
                </span>
                <button class="btn btn-sm btn-light" @click="addPaymentMethod">
                    <i class="fas fa-plus"></i>
                </button>
            </div>
            <div class="card-body p-3">
                <div v-for="(payment, index) in paymentMethods" :key="index" class="payment-method-card">
                    <div class="row g-2 align-items-center">
                        <div class="col-5">
                            <select class="form-select payment-select" v-model="payment.method">
                                <option value="cash">💵 Cash</option>
                                <option value="card">💳 Card</option>
                                <option value="upi">📱 UPI</option>
                                <option value="wallet">👛 Wallet</option>
                            </select>
                        </div>
                        <div class="col-5">
                            <input type="number" class="form-control payment-input" placeholder="Amount" v-model="payment.amount" min="0">
                        </div>
                        <div class="col-2">
                            <button class="btn btn-sm text-danger" @click="removePaymentMethod(index)" v-if="paymentMethods.length &gt; 1" style="background: none; border: none;">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Order Summary -->
        <div class="checkout-card">
            <div class="card-body">
                <div class="summary-row">
                    <span>Subtotal:</span>
                    <strong>₹{{ Number(subtotal).toFixed(2) }}</strong>
                </div>
                <div class="summary-row">
                    <span>Discount:</span>
                    <strong class="text-danger">-₹{{ Number(discountAmount).toFixed(2) }}</strong>
                </div>
                <div class="summary-row">
                    <span>Tax (18%):</span>
                    <strong>₹{{ Number(taxAmount).toFixed(2) }}</strong>
                </div>
                
                <div class="summary-total">
                    <div class="d-flex justify-content-between align-items-center">
                        <span style="font-size: 1.2rem; font-weight: 600;">Total:</span>
                        <strong style="font-size: 1.5rem;">₹{{ Number(total).toFixed(2) }}</strong>
                    </div>
                </div>
                
                <div class="summary-row">
                    <span>Total Paid:</span>
                    <span>₹{{ Number(totalPaid).toFixed(2) }}</span>
                </div>
                <div class="summary-row" :class="balance &gt;= 0 ? 'text-success' : 'text-danger'">
                    <span>{{ balance &gt;= 0 ? 'Change:' : 'Balance Due:' }}</span>
                    <strong>₹{{ Number(balance).toFixed(2) }}</strong>
                </div>
            </div>
        </div>

        <!-- Action Buttons -->
        <div class="d-grid gap-3">
            <button class="btn submit-btn" @click="submitOrder" :disabled="cartItems.length === 0 || balance &lt; 0">
                <i class="fas fa-check me-2"></i>
                {{ balance &lt; 0 ? 'Insufficient Payment' : 'Complete Order' }}
            </button>
            
            <div class="row g-2">
                <div class="col-6">
                    <button class="btn action-btn w-100" @click="printOrder">
                        <i class="fas fa-print me-2"></i>
                        Print
                    </button>
                </div>
                <div class="col-6">
                    <button class="btn action-btn w-100" @click="clearCart">
                        <i class="fas fa-refresh me-2"></i>
                        Reset
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
        cartItems: Array,
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
        
    },
    methods: {
        
    },
};
</script>

<style scoped>

</style>