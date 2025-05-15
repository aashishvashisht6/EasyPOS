<template>
    <div class="container-fluid bg-light">
        <div class="row mt-4">
            <div class="col-md-1 border-right">
                <ItemGroup />
            </div>
            <div class="col-md-8 border-end">
                <Item />
            </div>
            <div class="col-md-3">
                Checkout
            </div>
        </div>
    </div>
</template>

<script>
import ItemGroup from "./components/ItemGroup.vue"
import Item from "./components/Item.vue"
export default {
    components: {
        ItemGroup, Item
    }
}
</script>

<style>
.vertical-divider {
    border-right: 4px solid #ccc;
}

.hover-border-green {
    transition: border 0.3s ease;
    border: 1px solid transparent;
}

.hover-border-green:hover {
    border: 2px solid green;
}

</style>