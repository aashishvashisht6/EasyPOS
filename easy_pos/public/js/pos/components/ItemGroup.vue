<template>
    <div class="card m-3 text-center hover-border-green" style="width: 100px; height: 130px;" v-for="group in itemGroups"
        :key="group.name">
        <img :src="group.image" class="card-img-top mx-auto mt-3"
            style="width: 70px; height: 60px; object-fit: contain;" />
        <div class="card-body p-2 d-flex flex-column justify-content-center">
            <p class="card-text mt-2">{{ group.name }}</p>
        </div>
    </div>

</template>

<script>
export default {
    data() {
        return {
            loading: false,
            itemGroups: [],
        }
    },
    created() {
        this.getItemGroups();
    },
    methods: {
        getItemGroups() {
            this.loading = true;
            frappe.call({
                method: "easy_pos.api.item.get_item_groups",
                callback: (resp) => {
                    this.loading = false;
                    this.itemGroups = resp?.message || [];
                }
            });
        }
    }
}
</script>