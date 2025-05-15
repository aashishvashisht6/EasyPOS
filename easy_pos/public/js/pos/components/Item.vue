<template>
    <div class="row mb-3">
        <div class="col d-flex justify-content-end">
            <input type="text" class="" style="width: 200px;" />
        </div>
    </div>

    <div style="height: 100vh; overflow-y: auto; overflow-x: hidden;"  class="scroll-container p-3">
        <div class="row">
            <div class="card m-3 text-center hover-border-green" style="width: 200px; height: 220px;" v-for="item in items"
                :key="item.name">
                <img :src="item.image" class="card-img-top mx-auto mt-3"
                    style="width: 140px; height: 60px; object-fit: contain;" />
                <div class="card-body p-2 d-flex flex-column justify-content-center">
                    <p class="text-left fw-light fs-6 mb-1">{{ item.item_group }}</p>
                    <p class="card-text text-left fw-bold mb-0">{{ item.name }}</p>
                    <p class="card-text text-left fw-light fs-6 mb-0 text-truncate">{{ item.item_name }}</p>
                </div>
                <hr class="my-2" />

                <!-- Price & Quantity Controls -->
                <div class="d-flex justify-content-between align-items-center px-3 pb-2">
                    <!-- Price -->
                    <span class="fw-bold text-primary">{{ item.price | currency }}</span>

                    <!-- Quantity Controls -->
                    <div class="d-flex align-items-center">
                        <button class="btn btn-sm btn-outline-secondary px-2 py-0"
                            @click.stop="decreaseQty(item)">−</button>
                        <span class="mx-2">{{ item.qty }}</span>
                        <button class="btn btn-sm btn-outline-secondary px-2 py-0"
                            @click.stop="increaseQty(item)">+</button>
                    </div>
                </div>
            </div>
        </div>
    </div>



</template>

<script>
export default {
    data() {
        return {
            loading: false,
            items: [],
        }
    },
    created() {
        this.loading = true;
        frappe.call({
            method: "easy_pos.api.item.get_items",
            callback: (resp) => {
                this.loading = false;
                this.items = resp?.message || [];
            }
        });
    },

}
</script>

<style>
.text-truncate {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;

}
.scroll-container::-webkit-scrollbar {
  width: 8px;
}

.scroll-container::-webkit-scrollbar-track {
  background: orange;
}

.scroll-container::-webkit-scrollbar-thumb {
  background-color: #c75b00;
  border-radius: 4px;
}

/* Firefox */
.scroll-container {
  scrollbar-color: #c75b00 lightgrey;
  scrollbar-width: thin;
}



</style>