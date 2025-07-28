<template>
    <div class="container-fluid pos-container">
        <div class="row h-100">
            <!-- Section 1: Item Groups -->
            <div class="col-md-2 section item-groups-section">
                <ItemGroup @group-selected="onGroupSelected" :selectedGroup="selectedGroup" />
            </div>


            <!-- Section 2: Item Search and Cards -->
            <div class="col-md-6 section items-section">
                <Item :selectedGroup="selectedGroup" :cartItems="cartItems" @item-added="onItemAdded" />
            </div>

            <!-- Section 3: Checkout -->
            <div class="col-md-4 section checkout-section">
                <Checkout :cartItems="cartItems" />
            </div>
        </div>
    </div>
</template>

<script>
import ItemGroup from "./components/ItemGroup.vue"
import Item from "./components/Item.vue"
import Checkout from "./components/checkout/Checkout.vue"


export default {
    components: {
        ItemGroup, Item, Checkout
    },
    data() {
        return {
            selectedGroup: null,
            cartItems: [],
            isOnline: navigator.onLine
        };
    },
    created() {
        window.addEventListener('online', console.log("You are online!"));
        window.addEventListener('offline', () => {
            this.isOnline = false;
            console.log("You're offline. Orders will be saved locally.");
        });
    },
    methods: {
        onGroupSelected(group) {
            this.selectedGroup = group
        },
        onItemAdded(item) {
            const existingItem = this.cartItems.find(cartItem => cartItem.name === item.name);
            if (existingItem) {
                existingItem.quantity += 1;
            } else {
                this.cartItems.push({ ...item, quantity: 1 });
            }
            console.log("Item added to cart:", this.cartItems);
        },
    }
}
</script>

<style>
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap');

* {
    font-family: 'Poppins', sans-serif;
}

:root {
    --primary-gradient: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    --secondary-gradient: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
    --success-gradient: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
    --warning-gradient: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
    --card-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
    --card-hover-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
    --border-radius: 20px;
    --glass-bg: rgba(255, 255, 255, 0.25);
    --glass-border: rgba(255, 255, 255, 0.18);
}

body {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    min-height: 100vh;
    overflow-x: hidden;
}

.pos-container {
    height: 100vh;
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.2);
}

.section {
    height: 100vh;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.3) transparent;
}

.section::-webkit-scrollbar {
    width: 6px;
}

.section::-webkit-scrollbar-track {
    background: transparent;
}

.section::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.3);
    border-radius: 10px;
}

/* Item Groups Section */
.item-groups-section {
    background: rgba(255, 255, 255, 0.15);
    backdrop-filter: blur(15px);
    border-right: 1px solid rgba(255, 255, 255, 0.2);
}

.section-title {
    color: white;
    font-weight: 600;
    text-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
    margin-bottom: 2rem;
}

.item-group-btn {
    min-height: 80px;
    border: 2px solid rgba(255, 255, 255, 0.2);
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
    border-radius: var(--border-radius);
    color: white;
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
    overflow: hidden;
    background: var(--primary-gradient);
    border-color: rgba(255, 255, 255, 0.4);
    box-shadow: 0 15px 35px rgba(102, 126, 234, 0.4);
}

.item-group-btn:hover {
    transform: translateY(-5px) scale(1.05);
    box-shadow: var(--card-hover-shadow);
    background: rgba(255, 255, 255, 0.2);
}

.item-group-btn.active {
    background: var(--warning-gradient) !important;
    border-color: rgba(255, 255, 255, 0.4);
    box-shadow: 0 15px 35px rgba(102, 126, 234, 0.4);
}

.item-group-btn::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
    transition: left 0.5s;
}

.item-group-btn:hover::before {
    left: 100%;
}

.group-icon {
    font-size: 1.8rem;
    margin-bottom: 0.5rem;
    display: block;
}

/* Items Section */
.items-section {
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(20px);
}

.search-container {
    position: relative;
    margin-bottom: 2rem;
}

.search-input {
    border: none;
    border-radius: 25px;
    padding: 1rem 1rem 1rem 3.5rem;
    background: rgba(255, 255, 255, 0.9);
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
    font-size: 1.1rem;
    transition: all 0.3s ease;
}

.search-input:focus {
    outline: none;
    box-shadow: 0 15px 35px rgba(0, 0, 0, 0.15);
    transform: translateY(-2px);
}

.search-icon {
    position: absolute;
    left: 1.2rem;
    top: 50%;
    transform: translateY(-50%);
    color: #667eea;
    font-size: 1.2rem;
}

.item-card {
    border: none;
    border-radius: var(--border-radius);
    background: white;
    box-shadow: var(--card-shadow);
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    cursor: pointer;
    overflow: hidden;
    position: relative;
    height: 280px;
}

.item-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: var(--primary-gradient);
    transform: scaleX(0);
    transition: transform 0.3s ease;
}

.item-card:hover::before {
    transform: scaleX(1);
}

.item-card:hover {
    transform: translateY(-10px) scale(1.02);
    box-shadow: var(--card-hover-shadow);
}

.item-icon-container {
    height: 120px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #f8f9ff 0%, #e8f0ff 100%);
    margin: -1rem -1rem 1rem -1rem;
    position: relative;
    overflow: hidden;
}

.item-icon-container::before {
    content: '';
    position: absolute;
    top: -50%;
    left: -50%;
    width: 200%;
    height: 200%;
    background: radial-gradient(circle, rgba(102, 126, 234, 0.1) 0%, transparent 70%);
    transform: scale(0);
    transition: transform 0.5s ease;
}

.item-card:hover .item-icon-container::before {
    transform: scale(1);
}

.item-icon {
    font-size: 3rem;
    background: var(--primary-gradient);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    transition: all 0.3s ease;
}

.stock-badge {
    position: absolute;
    top: 15px;
    right: 15px;
    border-radius: 20px;
    padding: 0.3rem 0.8rem;
    font-size: 0.8rem;
    font-weight: 600;
    text-shadow: none;
}

.stock-high {
    background: var(--warning-gradient);
    color: white;
}

.stock-medium {
    background: var(--secondary-gradient);
    color: white;
}

.stock-low {
    background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%);
    color: white;
}

.item-name {
    font-weight: 600;
    color: #2c3e50;
    margin-bottom: 0.5rem;
}

.item-description {
    color: #7f8c8d;
    font-size: 0.9rem;
    margin-bottom: 1rem;
}

.item-price {
    font-size: 1.4rem;
    font-weight: 700;
    background: var(--primary-gradient);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
}

.add-btn {
    background: var(--success-gradient);
    border: none;
    border-radius: 50%;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    transition: all 0.3s ease;
}

.add-btn:hover {
    transform: scale(1.1) rotate(90deg);
    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
}

/* Checkout Section */
.checkout-section {
    background: rgba(255, 255, 255, 0.98);
    backdrop-filter: blur(20px);
    border-left: 1px solid rgba(255, 255, 255, 0.2);
}

.checkout-card {
    background: white;
    border: none;
    border-radius: var(--border-radius);
    box-shadow: var(--card-shadow);
    margin-bottom: 1.5rem;
    overflow: hidden;
}

.checkout-card-header {
    background: var(--primary-gradient);
    color: white;
    padding: 1rem;
    border: none;
    font-weight: 600;
}

.customer-input {
    border: 2px solid #e9ecef;
    border-radius: 15px;
    padding: 0.8rem 1rem;
    transition: all 0.3s ease;
}

.customer-input:focus {
    border-color: #667eea;
    box-shadow: 0 0 0 0.2rem rgba(102, 126, 234, 0.25);
    outline: none;
}

.loyalty-points {
    background: var(--warning-gradient);
    color: white;
    border-radius: 25px;
    padding: 0.5rem 1rem;
    font-size: 0.9rem;
    font-weight: 600;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.5rem;
    animation: pulse 2s infinite;
}

@keyframes pulse {
    0% {
        transform: scale(1);
    }

    50% {
        transform: scale(1.05);
    }

    100% {
        transform: scale(1);
    }
}

.cart-item {
    padding: 1rem;
    border-bottom: 1px solid #f8f9fa;
    transition: all 0.3s ease;
}

.cart-item:hover {
    background: linear-gradient(135deg, #f8f9ff 0%, #e8f0ff 100%);
}

.cart-item:last-child {
    border-bottom: none;
}

.quantity-btn {
    width: 35px;
    height: 35px;
    border-radius: 50%;
    border: 2px solid #e9ecef;
    background: white;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s ease;
}

.quantity-btn:hover {
    background: var(--primary-gradient);
    color: white;
    border-color: transparent;
    transform: scale(1.1);
}

.payment-method-card {
    background: linear-gradient(135deg, #f8f9ff 0%, #e8f0ff 100%);
    border: 2px solid rgba(102, 126, 234, 0.1);
    border-radius: 15px;
    padding: 1rem;
    margin-bottom: 1rem;
    transition: all 0.3s ease;
}

.payment-method-card:hover {
    border-color: rgba(102, 126, 234, 0.3);
    transform: translateY(-2px);
}

.payment-select,
.payment-input {
    border: 2px solid rgba(102, 126, 234, 0.2);
    border-radius: 10px;
    padding: 0.6rem;
    transition: all 0.3s ease;
}

.payment-select:focus,
.payment-input:focus {
    border-color: #667eea;
    box-shadow: 0 0 0 0.2rem rgba(102, 126, 234, 0.15);
    outline: none;
}

.summary-row {
    padding: 0.8rem 0;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-weight: 500;
}

.summary-total {
    background: var(--success-gradient);
    color: white;
    padding: 1rem;
    border-radius: 15px;
    margin: 1rem 0;
    text-align: center;
}

.submit-btn {
    background: var(--success-gradient);
    border: none;
    border-radius: 15px;
    padding: 1rem 2rem;
    color: white;
    font-weight: 600;
    font-size: 1.1rem;
    transition: all 0.4s ease;
    position: relative;
    overflow: hidden;
}

.submit-btn:hover {
    transform: translateY(-3px);
    box-shadow: 0 15px 35px rgba(79, 172, 254, 0.4);
}

.submit-btn::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
    transition: left 0.5s;
}

.submit-btn:hover::before {
    left: 100%;
}

.action-btn {
    border: 2px solid rgba(102, 126, 234, 0.3);
    border-radius: 12px;
    padding: 0.8rem;
    background: white;
    color: #667eea;
    font-weight: 500;
    transition: all 0.3s ease;
}

.action-btn:hover {
    background: var(--primary-gradient);
    color: white;
    border-color: transparent;
    transform: translateY(-2px);
}

.empty-cart {
    text-align: center;
    padding: 2rem;
    color: #7f8c8d;
}

.empty-cart i {
    font-size: 3rem;
    margin-bottom: 1rem;
    opacity: 0.5;
}

/* Animations */
@keyframes fadeInUp {
    from {
        opacity: 0;
        transform: translateY(30px);
    }

    to {
        opacity: 1;
        transform: translateY(0);
    }
}

.fade-in-up {
    animation: fadeInUp 0.6s ease-out;
}

/* Responsive adjustments */
@media (max-width: 768px) {
    .item-card {
        height: 250px;
    }

    .item-icon {
        font-size: 2.5rem;
    }

    .item-icon-container {
        height: 100px;
    }
}
</style>