<template>
  <div class="customer-search-container">
    <!-- Search Input Container -->
    <div class="search-container">
      <div class="search-input-wrapper" :class="{ 'focused': isInputFocused, 'has-results': showDropdown }">
        <div class="input-icon">
          <i class="fas fa-search"></i>
        </div>
        <input
          ref="searchInput"
          type="text"
          class="search-input"
          placeholder="Search customer by name or phone..."
          v-model="customerSearch"
          @input="handleInput"
          @focus="handleFocus"
          @blur="handleBlur"
          @keydown="handleKeydown"
          autocomplete="off"
        />
        <div v-if="customerSearch" class="clear-button" @click="clearSearch">
          <i class="fas fa-times"></i>
        </div>
        <div v-if="isLoading" class="loading-spinner">
          <i class="fas fa-spinner fa-spin"></i>
        </div>
      </div>

      <!-- Custom Dropdown -->
      <teleport to="body">
        <transition name="dropdown-fade">
          <div v-if="showDropdown" class="dropdown-container" :style="dropdownStyle">
            <div class="dropdown-content">
              <div
                v-for="(customer, index) in filteredCustomers"
                :key="customer.id"
                class="dropdown-item"
                :class="{ 
                  'highlighted': index === highlightedIndex,
                  'selected': selectedCustomer && selectedCustomer.id === customer.id
                }"
                @click="selectCustomer(customer)"
                @mouseenter="highlightedIndex = index"
              >
                <div class="customer-info">
                  <div class="customer-main">
                    <span class="customer-name">{{ customer.name }}</span>
                    <span class="customer-phone">{{ customer.phone }}</span>
                  </div>
                  <div class="customer-meta">
                    <span class="loyalty-badge" :class="getLoyaltyTier(customer.loyaltyPoints)">
                      <i class="fas fa-star"></i>
                      {{ customer.loyaltyPoints }} pts
                    </span>
                  </div>
                </div>
              </div>
              
              <div v-if="filteredCustomers.length === 0 && customerSearch" class="no-results">
                <i class="fas fa-user-plus"></i>
                <span>No customers found</span>
                <button class="add-customer-btn" @click="addNewCustomer">
                  Add New Customer
                </button>
              </div>
            </div>
          </div>
        </transition>
      </teleport>
    </div>

    <!-- Selected Customer Card -->
    <transition name="slide-fade">
      <div v-if="selectedCustomer" class="selected-customer-card mb-3">
        <div class="customer-card-header">
          <div class="customer-avatar">
            <i class="fas fa-user"></i>
          </div>
          <div class="customer-details">
            <h4 class="customer-name">{{ selectedCustomer.name }}</h4>
            <p class="customer-contact">{{ selectedCustomer.phone }} • {{ selectedCustomer.email }}</p>
          </div>
          <button class="remove-selection" @click="clearSelection">
            <i class="fas fa-times"></i>
          </button>
        </div>
        
        <div class="customer-stats">
          <div class="stat-item">
            <div class="stat-icon loyalty">
              <i class="fas fa-star"></i>
            </div>
            <div class="stat-content">
              <span class="stat-value">{{ selectedCustomer.loyaltyPoints }}</span>
              <span class="stat-label">Loyalty Points</span>
            </div>
          </div>
          
          <div class="stat-item">
            <div class="stat-icon orders">
              <i class="fas fa-shopping-bag"></i>
            </div>
            <div class="stat-content">
              <span class="stat-value">{{ selectedCustomer.totalOrders }}</span>
              <span class="stat-label">Total Orders</span>
            </div>
          </div>
          
          <div class="stat-item">
            <div class="stat-icon tier" :class="getLoyaltyTier(selectedCustomer.loyaltyPoints)">
              <i class="fas fa-crown"></i>
            </div>
            <div class="stat-content">
              <span class="stat-value">{{ getTierName(selectedCustomer.loyaltyPoints) }}</span>
              <span class="stat-label">Tier Status</span>
            </div>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script>
export default {
  name: "EnhancedCustomerSearch",
  data() {
    return {
      customerSearch: '',
      customers: [
        // { 
        //   id: 1, 
        //   name: 'John Doe', 
        //   phone: '+1 (555) 123-4567',
        //   email: 'john.doe@email.com',
        //   loyaltyPoints: 120,
        //   totalOrders: 15
        // },
        // { 
        //   id: 2, 
        //   name: 'Jane Smith', 
        //   phone: '+1 (555) 987-6543',
        //   email: 'jane.smith@email.com',
        //   loyaltyPoints: 280,
        //   totalOrders: 32
        // },
        // { 
        //   id: 3, 
        //   name: 'Alice Johnson', 
        //   phone: '+1 (555) 456-7890',
        //   email: 'alice.johnson@email.com',
        //   loyaltyPoints: 450,
        //   totalOrders: 58
        // },
        // { 
        //   id: 4, 
        //   name: 'Bob Wilson', 
        //   phone: '+1 (555) 321-0987',
        //   email: 'bob.wilson@email.com',
        //   loyaltyPoints: 75,
        //   totalOrders: 8
        // },
        // { 
        //   id: 5, 
        //   name: 'Carol Davis', 
        //   phone: '+1 (555) 654-3210',
        //   email: 'carol.davis@email.com',
        //   loyaltyPoints: 320,
        //   totalOrders: 41
        // }
      ],
      selectedCustomer: null,
      isInputFocused: false,
      showDropdown: false,
      highlightedIndex: -1,
      isLoading: false,
      searchTimeout: null,
      dropdownStyle: {}
    };
  },
  mounted() {
    // Add scroll and resize listeners to update dropdown position
    window.addEventListener('scroll', this.updateDropdownPosition, true);
    window.addEventListener('resize', this.updateDropdownPosition);
  },
  beforeUnmount() {
    // Clean up listeners
    window.removeEventListener('scroll', this.updateDropdownPosition, true);
    window.removeEventListener('resize', this.updateDropdownPosition);
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
  },
  computed: {
    filteredCustomers() {
      if (!this.customerSearch.trim()) return [];
      
      const searchTerm = this.customerSearch.toLowerCase();
      return this.customers.filter(customer => 
        customer.name.toLowerCase().includes(searchTerm) ||
        customer.phone.toLowerCase().includes(searchTerm) ||
        customer.email.toLowerCase().includes(searchTerm)
      ).slice(0, 5); // Limit to 20 results for better UX
    }
  },
  created() {
    this.getCustomers();
  },
  methods: {
    getCustomers() {
      frappe.call({
                method: "easy_pos.api.customer.get_customers",
                args: {},
                callback: (resp) => {
                    this.customers = resp?.message || [];
                }
            });
    },
    handleInput() {
      // Clear previous timeout
      if (this.searchTimeout) {
        clearTimeout(this.searchTimeout);
      }
      
      // Show loading state
      this.isLoading = true;
      
      // Simulate API debouncing
      this.searchTimeout = setTimeout(() => {
        this.isLoading = false;
        this.showDropdown = this.customerSearch.trim().length > 0;
        this.highlightedIndex = -1;
        if (this.showDropdown) {
          this.updateDropdownPosition();
        }
      }, 300);
    },
    
    handleFocus() {
      this.isInputFocused = true;
      if (this.customerSearch.trim()) {
        this.showDropdown = true;
        this.$nextTick(() => {
          this.updateDropdownPosition();
        });
      }
    },
    
    handleBlur() {
      // Delay hiding dropdown to allow clicks
      setTimeout(() => {
        this.isInputFocused = false;
        this.showDropdown = false;
        this.highlightedIndex = -1;
      }, 200);
    },
    
    handleKeydown(event) {
      if (!this.showDropdown || this.filteredCustomers.length === 0) return;
      
      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          this.highlightedIndex = Math.min(
            this.highlightedIndex + 1, 
            this.filteredCustomers.length - 1
          );
          break;
          
        case 'ArrowUp':
          event.preventDefault();
          this.highlightedIndex = Math.max(this.highlightedIndex - 1, 0);
          break;
          
        case 'Enter':
          event.preventDefault();
          if (this.highlightedIndex >= 0) {
            this.selectCustomer(this.filteredCustomers[this.highlightedIndex]);
          }
          break;
          
        case 'Escape':
          this.showDropdown = false;
          this.$refs.searchInput.blur();
          break;
      }
    },
    
    selectCustomer(customer) {
      this.selectedCustomer = customer;
      this.customerSearch = customer.name;
      this.showDropdown = false;
      this.highlightedIndex = -1;
      this.$emit('customer-selected', customer);
    },
    
    clearSearch() {
      this.customerSearch = '';
      this.selectedCustomer = null;
      this.showDropdown = false;
      this.$refs.searchInput.focus();
      this.$emit('customer-cleared');
    },
    
    clearSelection() {
      this.selectedCustomer = null;
      this.customerSearch = '';
      this.$emit('customer-cleared');
    },
    
    addNewCustomer() {
      this.$emit('add-new-customer', this.customerSearch);
      this.showDropdown = false;
    },
    
    getLoyaltyTier(points) {
      if (points >= 400) return 'platinum';
      if (points >= 200) return 'gold';
      if (points >= 100) return 'silver';
      return 'bronze';
    },
    
    getTierName(points) {
      if (points >= 400) return 'Platinum';
      if (points >= 200) return 'Gold';
      if (points >= 100) return 'Silver';
      return 'Bronze';
    },
    
    updateDropdownPosition() {
      if (!this.$refs.searchInput) return;
      
      const inputRect = this.$refs.searchInput.getBoundingClientRect();
      const containerRect = this.$el.querySelector('.search-input-wrapper').getBoundingClientRect();
      
      this.dropdownStyle = {
        position: 'fixed',
        top: `${containerRect.bottom}px`,
        left: `${containerRect.left}px`,
        width: `${containerRect.width}px`,
        zIndex: 99999
      };
    }
  }
}
</script>

<style scoped>
.customer-search-container {
  max-width: 500px;
  margin: 0 auto;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

/* Header Styles */
.customer-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 16px 16px 0 0;
  padding: 20px 24px;
  color: white;
  box-shadow: 0 4px 20px rgba(102, 126, 234, 0.3);
}

.header-content {
  display: flex;
  align-items: center;
  gap: 12px;
}

.icon-wrapper {
  width: 40px;
  height: 40px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(10px);
}

.header-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  letter-spacing: -0.5px;
}

/* Search Container */
.search-container {
  position: relative;
  padding: 24px;
  background: white;
  border-radius: 0 0 16px 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}

.search-input-wrapper {
  position: relative;
  background: #f8fafc;
  border: 2px solid #e2e8f0;
  border-radius: 12px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}

.search-input-wrapper.focused {
  border-color: #667eea;
  box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.1);
  background: white;
}

.search-input-wrapper.has-results {
  border-radius: 12px 12px 0 0;
}

.input-icon {
  position: absolute;
  left: 16px;
  top: 50%;
  transform: translateY(-50%);
  color: #64748b;
  z-index: 2;
  transition: color 0.3s ease;
}

.search-input-wrapper.focused .input-icon {
  color: #667eea;
}

.search-input {
  width: 100%;
  padding: 18px 48px 18px 48px;
  border: none;
  background: transparent;
  font-size: 16px;
  color: #1e293b;
  outline: none;
  font-weight: 500;
}

.search-input::placeholder {
  color: #94a3b8;
  font-weight: 400;
}

.clear-button, .loading-spinner {
  position: absolute;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #64748b;
  transition: all 0.3s ease;
  z-index: 2;
}

.clear-button:hover {
  color: #ef4444;
  background: rgba(239, 68, 68, 0.1);
  border-radius: 50%;
}

.loading-spinner {
  cursor: default;
  color: #667eea;
}

/* Dropdown Styles */
.dropdown-container {
  background: white;
  border: 2px solid #e2e8f0;
  border-radius: 0 0 12px 12px;
  box-shadow: 0 12px 48px rgba(0, 0, 0, 0.15);
  max-height: 320px;
  overflow-y: auto;
}

.dropdown-content {
  padding: 8px 0;
}

.dropdown-item {
  padding: 16px 20px;
  cursor: pointer;
  transition: all 0.2s ease;
  border-left: 4px solid transparent;
}

.dropdown-item:hover,
.dropdown-item.highlighted {
  background: #f1f5f9;
  border-left-color: #667eea;
}

.dropdown-item.selected {
  background: #ede7f6;
  border-left-color: #9c27b0;
}

.customer-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.customer-main {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.customer-name {
  font-weight: 600;
  color: #1e293b;
  font-size: 15px;
}

.customer-phone {
  font-size: 13px;
  color: #64748b;
}

.loyalty-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.loyalty-badge.bronze {
  background: #fef3c7;
  color: #92400e;
}

.loyalty-badge.silver {
  background: #f3f4f6;
  color: #374151;
}

.loyalty-badge.gold {
  background: #fef3c7;
  color: #d97706;
}

.loyalty-badge.platinum {
  background: #ede9fe;
  color: #7c3aed;
}

.no-results {
  padding: 32px 20px;
  text-align: center;
  color: #64748b;
}

.no-results i {
  font-size: 32px;
  margin-bottom: 12px;
  color: #cbd5e1;
}

.add-customer-btn {
  margin-top: 12px;
  padding: 8px 16px;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
}

.add-customer-btn:hover {
  background: #5a67d8;
  transform: translateY(-1px);
}

/* Selected Customer Card */
.selected-customer-card {
  margin-top: 24px;
  background: linear-gradient(135deg, #f8fafc 0%, #ffffff 100%);
  border: 2px solid #e2e8f0;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
}

.customer-card-header {
  padding: 20px 24px;
  display: flex;
  align-items: center;
  gap: 16px;
  border-bottom: 1px solid #e2e8f0;
  background: white;
}

.customer-avatar {
  width: 48px;
  height: 48px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 20px;
}

.customer-details {
  flex: 1;
}

.customer-details .customer-name {
  margin: 0 0 4px 0;
  font-size: 18px;
  font-weight: 600;
  color: #1e293b;
}

.customer-contact {
  margin: 0;
  font-size: 14px;
  color: #64748b;
}

.remove-selection {
  width: 32px;
  height: 32px;
  background: #f1f5f9;
  border: none;
  border-radius: 8px;
  color: #64748b;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.remove-selection:hover {
  background: #fee2e2;
  color: #dc2626;
}

.customer-stats {
  padding: 20px 24px;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 20px;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 12px;
}

.stat-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 16px;
}

.stat-icon.loyalty {
  background: linear-gradient(135deg, #fbbf24, #f59e0b);
}

.stat-icon.orders {
  background: linear-gradient(135deg, #10b981, #059669);
}

.stat-icon.tier.bronze {
  background: linear-gradient(135deg, #cd7c2f, #b45309);
}

.stat-icon.tier.silver {
  background: linear-gradient(135deg, #9ca3af, #6b7280);
}

.stat-icon.tier.gold {
  background: linear-gradient(135deg, #f59e0b, #d97706);
}

.stat-icon.tier.platinum {
  background: linear-gradient(135deg, #8b5cf6, #7c3aed);
}

.stat-content {
  display: flex;
  flex-direction: column;
}

.stat-value {
  font-size: 18px;
  font-weight: 700;
  color: #1e293b;
  line-height: 1.2;
}

.stat-label {
  font-size: 13px;
  color: #64748b;
  font-weight: 500;
}

/* Animations */
.dropdown-fade-enter-active,
.dropdown-fade-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.dropdown-fade-enter-from {
  opacity: 0;
  transform: translateY(-8px);
}

.dropdown-fade-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

.slide-fade-enter-active {
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.slide-fade-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.6, 1);
}

.slide-fade-enter-from {
  opacity: 0;
  transform: translateY(20px) scale(0.95);
}

.slide-fade-leave-to {
  opacity: 0;
  transform: translateY(-10px) scale(0.98);
}

/* Responsive Design */
@media (max-width: 480px) {
  .customer-search-container {
    margin: 0 16px;
  }
  
  .search-container {
    padding: 16px;
  }
  
  .customer-stats {
    grid-template-columns: 1fr;
    gap: 16px;
  }
  
  .dropdown-container {
    left: 16px;
    right: 16px;
  }
}
</style>