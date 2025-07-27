<template>
    <div class="checkout-card-header d-flex justify-content-between align-items-center">
        <span>
            <i class="fas fa-shopping-basket me-2"></i>
            Cart Items
        </span>
        <span class="badge bg-light text-dark">{{ cartItems.length }}</span>
    </div>
    <div class="card-body p-0" style="max-height: 300px; overflow-y: auto;">
        <div v-if="cartItems.length === 0" class="empty-cart">
            <i class="fas fa-shopping-cart"></i>
            <p class="mb-0">Your cart is empty</p>
            <small>Add items to get started</small>
        </div>

        <div v-for="(item, index) in cartItems" :key="index" class="cart-item">
            <div class="d-flex justify-content-between align-items-start mb-2">
                <div class="flex-grow-1">
                    <h6 class="mb-1" style="color: #2c3e50;">{{ item.name }}</h6>
                    <small class="text-muted">₹{{ item.rate }} each</small>
                </div>
                <button class="btn btn-sm text-danger" @click="removeFromCart(index)"
                    style="background: none; border: none;">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
            <div class="d-flex justify-content-between align-items-center">
                <div class="d-flex align-items-center gap-2">
                    <button class="quantity-btn" @click="updateQuantity(index, -1)">
                        <i class="fas fa-minus"></i>
                    </button>
                    <span style="min-width: 30px; text-align: center; font-weight: 600;">{{ item.quantity }}</span>
                    <button class="quantity-btn" @click="updateQuantity(index, 1)">
                        <i class="fas fa-plus"></i>
                    </button>
                </div>
                <div class="text-end">
                    <strong style="color: #667eea; font-size: 1.1rem;">
                        ₹{{ ((Number(item?.rate) || 0) * (Number(item?.quantity) || 0)).toFixed(2) }}
                    </strong>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
export default {
    name: "CartItems",
    data() {
        return {
        };
    },
    props: {
        cartItems: Array
    },
    methods: {
        removeFromCart(index) {
            this.$emit('remove-from-cart', index);
        },
        updateQuantity(index, change) {
            this.$emit('update-quantity', index, change);
        }
    }
}
</script>