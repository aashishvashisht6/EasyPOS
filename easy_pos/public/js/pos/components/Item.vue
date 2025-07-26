<template>
    <div class="p-4">
        <!-- Search Bar -->
        <div class="search-container">
            <div class="position-relative">
                <i class="fas fa-search search-icon"></i>
                <input type="text" class="form-control search-input" placeholder="Search for items..."
                    v-model="searchQuery">
            </div>
        </div>

        <!-- Item Cards -->
        <div class="row">
            <div v-for="item in items" :key="item.id" class="col-md-4 col-sm-6 mb-4 fade-in-up">
                <div class="card item-card h-100" @click="addToCart(item)">
                    <div class="card-body p-0 h-100 d-flex flex-column">
                        <div class="item-icon-container">
                            <i :class="item.icon" class="item-icon"></i>
                            <span class="badge stock-badge" :class="{
                                'stock-high': item.stock > 10,
                                'stock-medium': item.stock <= 10 && item.stock > 5,
                                'stock-low': item.stock <= 5
                            }">
                                {{ item.stock }} left
                            </span>
                        </div>

                        <div class="p-3 flex-grow-1 d-flex flex-column">
                            <h6 class="item-name">{{ item.name }}</h6>
                            <p class="item-description">{{ item.description }}</p>

                            <div class="mt-auto d-flex justify-content-between align-items-center">
                                <div class="item-price">₹{{ item.rate }}</div>
                                <button class="btn add-btn">
                                    <svg class="icon  icon-xs" style="" aria-hidden="true">
                                        <use class="" href="#icon-add"></use>
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>



</template>

<script>


export default {
    props: {
        selectedGroup: String
    },
    components: {
        // RecycleScroller
    },
    data() {
        return {
            loading: false,
            items: [],
        }
    },
    created() {
        this.getItems()
    },
    watch: {
        selectedGroup: {
            immediate: true,
            handler(newGroup) {
                this.getItems(); // Re-fetch items when group changes
            }
        }
    },
    methods: {
        getItems() {
            this.loading = true;
            frappe.call({
                method: "easy_pos.api.item.get_items",
                args: { item_group: this.selectedGroup },
                callback: (resp) => {
                    this.loading = false;
                    this.items = resp?.message || [];
                }
            });
        }
    }

}
</script>

<style></style>