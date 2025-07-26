<template>
    <div class="p-2">
        <div class="d-flex flex-column gap-3">
            <h3 class="section-title mt-2" style="align-self: center;">
                <i class="fas fa-layer-group me-2"></i>
                Item Groups
            </h3>
            <button v-for="group in itemGroups" :key="group.name" class="btn item-group-btn"
                :class="{ 'active': selectedGroup === group.name }" @click="selectGroup(group.name)">
                <div>
                    <i :class="group.icon" class="group-icon"></i>
                    <div style="font-size: 0.9rem; font-weight: 500;">{{ group.name }}</div>
                </div>
            </button>
        </div>
    </div>
</template>

<script>
export default {
    props: {
        selectedGroup: String,
    },
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
        },
        selectGroup(groupName) {
            console.log("Selected Group:", this.selectedGroup, "New Group:", groupName);
            this.$emit('group-selected', groupName);
        }
    }
}
</script>

<style>

</style>