<template>
  <div>
    <h2>🛒 Easy POS</h2>
    <ul>
      <li v-for="item in cart" :key="item.name">
        {{ item.item_name }} x {{ item.qty }}
      </li>
    </ul>
    <button @click="checkout">Checkout</button>
  </div>
</template>

<script>
export default {
  data() {
    return {
      cart: [
        { name: "ITEM001", item_name: "Sample Item", qty: 1 }
      ]
    };
  },
  methods: {
    checkout() {
      frappe.msgprint("Checkout")
    }
  }
};
</script>
