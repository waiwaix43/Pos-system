const fs = require('fs');
let c = fs.readFileSync('seed.js', 'utf8');

const getBlock = (start, end) => {
  const s = c.indexOf(start);
  const e = c.indexOf(end, s);
  return c.substring(s, e);
};

const newInvData = `const invData = [
    // Coffee
    { shop_id: shopId, category_id: null, name: 'Coffee Beans (Espresso)', quantity: 5000, unit: 'g', min_threshold: 1000, cost: 0.5, sku: 'RAW-TEST-001', type: 'material', supplier_id: supRes[0].id, status: 'active' },
    { shop_id: shopId, category_id: null, name: 'Coffee Beans (Filter)', quantity: 2000, unit: 'g', min_threshold: 500, cost: 0.8, sku: 'RAW-TEST-002', type: 'material', supplier_id: supRes[0].id, status: 'active' },
    // Tea
    { shop_id: shopId, category_id: null, name: 'Thai Tea Leaves', quantity: 3000, unit: 'g', min_threshold: 500, cost: 0.2, sku: 'RAW-TEA-001', type: 'material', supplier_id: supRes[0].id, status: 'active' },
    { shop_id: shopId, category_id: null, name: 'Matcha Powder', quantity: 2000, unit: 'g', min_threshold: 300, cost: 1.5, sku: 'RAW-TEA-002', type: 'material', supplier_id: supRes[0].id, status: 'active' },
    { shop_id: shopId, category_id: null, name: 'Earl Grey Tea', quantity: 1500, unit: 'g', min_threshold: 200, cost: 0.5, sku: 'RAW-TEA-003', type: 'material', supplier_id: supRes[0].id, status: 'active' },
    { shop_id: shopId, category_id: null, name: 'Peach Tea', quantity: 1500, unit: 'g', min_threshold: 200, cost: 0.5, sku: 'RAW-TEA-004', type: 'material', supplier_id: supRes[0].id, status: 'active' },
    // Cocoa & Non-Coffee
    { shop_id: shopId, category_id: null, name: 'Cocoa Powder', quantity: 2000, unit: 'g', min_threshold: 400, cost: 0.8, sku: 'RAW-COCOA-001', type: 'material', supplier_id: supRes[0].id, status: 'active' },
    { shop_id: shopId, category_id: null, name: 'Fresh Milk', quantity: 20000, unit: 'ml', min_threshold: 5000, cost: 0.05, sku: 'RAW-MILK-001', type: 'material', supplier_id: supRes[1].id, status: 'active' },
    { shop_id: shopId, category_id: null, name: 'Condensed Milk', quantity: 10000, unit: 'ml', min_threshold: 2000, cost: 0.08, sku: 'RAW-MILK-002', type: 'material', supplier_id: supRes[1].id, status: 'active' },
    { shop_id: shopId, category_id: null, name: 'Oat Milk', quantity: 5000, unit: 'ml', min_threshold: 1000, cost: 0.1, sku: 'RAW-MILK-003', type: 'material', supplier_id: supRes[1].id, status: 'active' },
    // Syrups & Fruits
    { shop_id: shopId, category_id: null, name: 'Vanilla Syrup', quantity: 3000, unit: 'ml', min_threshold: 500, cost: 0.2, sku: 'RAW-SYR-001', type: 'material', supplier_id: supRes[4].id, status: 'active' },
    { shop_id: shopId, category_id: null, name: 'Caramel Syrup', quantity: 3000, unit: 'ml', min_threshold: 500, cost: 0.2, sku: 'RAW-SYR-002', type: 'material', supplier_id: supRes[4].id, status: 'active' },
    { shop_id: shopId, category_id: null, name: 'Hazelnut Syrup', quantity: 2000, unit: 'ml', min_threshold: 300, cost: 0.25, sku: 'RAW-SYR-003', type: 'material', supplier_id: supRes[4].id, status: 'active' },
    { shop_id: shopId, category_id: null, name: 'Strawberry Puree', quantity: 2000, unit: 'ml', min_threshold: 300, cost: 0.3, sku: 'RAW-SYR-004', type: 'material', supplier_id: supRes[4].id, status: 'active' },
    { shop_id: shopId, category_id: null, name: 'Mango Puree', quantity: 2000, unit: 'ml', min_threshold: 300, cost: 0.3, sku: 'RAW-SYR-005', type: 'material', supplier_id: supRes[4].id, status: 'active' },
    { shop_id: shopId, category_id: null, name: 'Passion Fruit Syrup', quantity: 2000, unit: 'ml', min_threshold: 300, cost: 0.3, sku: 'RAW-SYR-006', type: 'material', supplier_id: supRes[4].id, status: 'active' },
    { shop_id: shopId, category_id: null, name: 'Blue Hawaii Syrup', quantity: 2000, unit: 'ml', min_threshold: 300, cost: 0.2, sku: 'RAW-SYR-007', type: 'material', supplier_id: supRes[4].id, status: 'active' },
    { shop_id: shopId, category_id: null, name: 'Red Syrup (Sala)', quantity: 3000, unit: 'ml', min_threshold: 500, cost: 0.15, sku: 'RAW-SYR-008', type: 'material', supplier_id: supRes[4].id, status: 'active' },
    { shop_id: shopId, category_id: null, name: 'Lemon Juice', quantity: 2000, unit: 'ml', min_threshold: 300, cost: 0.1, sku: 'RAW-FRT-001', type: 'material', supplier_id: supRes[4].id, status: 'active' },
    { shop_id: shopId, category_id: null, name: 'Soda Water', quantity: 10000, unit: 'ml', min_threshold: 2000, cost: 0.02, sku: 'RAW-LIQ-001', type: 'material', supplier_id: supRes[4].id, status: 'active' },
    // Bakery & Cake Items
    { shop_id: shopId, category_id: null, name: 'Butter Croissant (Frozen)', quantity: 200, unit: 'pcs', min_threshold: 20, cost: 25, sku: 'RAW-BAK-001', type: 'material', supplier_id: supRes[3].id, status: 'active' },
    { shop_id: shopId, category_id: null, name: 'Almond Croissant (Frozen)', quantity: 100, unit: 'pcs', min_threshold: 10, cost: 35, sku: 'RAW-BAK-002', type: 'material', supplier_id: supRes[3].id, status: 'active' },
    { shop_id: shopId, category_id: null, name: 'Chocolate Fudge Cake (Whole)', quantity: 10, unit: 'pcs', min_threshold: 2, cost: 400, sku: 'RAW-CAK-001', type: 'material', supplier_id: supRes[3].id, status: 'active' },
    { shop_id: shopId, category_id: null, name: 'New York Cheesecake (Whole)', quantity: 10, unit: 'pcs', min_threshold: 2, cost: 500, sku: 'RAW-CAK-002', type: 'material', supplier_id: supRes[3].id, status: 'active' },
    { shop_id: shopId, category_id: null, name: 'Red Velvet Cake (Whole)', quantity: 5, unit: 'pcs', min_threshold: 1, cost: 450, sku: 'RAW-CAK-003', type: 'material', supplier_id: supRes[3].id, status: 'active' },
    { shop_id: shopId, category_id: null, name: 'Brownie (Tray)', quantity: 15, unit: 'pcs', min_threshold: 3, cost: 300, sku: 'RAW-BAK-003', type: 'material', supplier_id: supRes[3].id, status: 'active' },
    { shop_id: shopId, category_id: null, name: 'Ham Cheese Sandwich', quantity: 50, unit: 'pcs', min_threshold: 10, cost: 30, sku: 'RAW-FOOD-001', type: 'material', supplier_id: supRes[3].id, status: 'active' },
    // Packaging
    { shop_id: shopId, category_id: null, name: '16 oz Cold Cup', quantity: 2000, unit: 'pcs', min_threshold: 500, cost: 2, sku: 'PKG-CUP-16', type: 'packaging', supplier_id: supRes[2].id, status: 'active' },
    { shop_id: shopId, category_id: null, name: '22 oz Cold Cup', quantity: 2000, unit: 'pcs', min_threshold: 500, cost: 2.5, sku: 'PKG-CUP-22', type: 'packaging', supplier_id: supRes[2].id, status: 'active' },
    { shop_id: shopId, category_id: null, name: '8 oz Hot Cup', quantity: 1000, unit: 'pcs', min_threshold: 200, cost: 1.5, sku: 'PKG-CUP-08', type: 'packaging', supplier_id: supRes[2].id, status: 'active' },
    { shop_id: shopId, category_id: null, name: 'Cold Cup Lid', quantity: 4000, unit: 'pcs', min_threshold: 1000, cost: 0.5, sku: 'PKG-LID-01', type: 'packaging', supplier_id: supRes[2].id, status: 'active' },
    { shop_id: shopId, category_id: null, name: 'Hot Cup Lid', quantity: 1000, unit: 'pcs', min_threshold: 200, cost: 0.5, sku: 'PKG-LID-02', type: 'packaging', supplier_id: supRes[2].id, status: 'active' },
    { shop_id: shopId, category_id: null, name: 'Straw', quantity: 5000, unit: 'pcs', min_threshold: 1000, cost: 0.2, sku: 'PKG-STR-01', type: 'packaging', supplier_id: supRes[2].id, status: 'active' },
    { shop_id: shopId, category_id: null, name: 'Paper Bag', quantity: 1000, unit: 'pcs', min_threshold: 200, cost: 1.5, sku: 'PKG-BAG-01', type: 'packaging', supplier_id: supRes[2].id, status: 'active' },
    { shop_id: shopId, category_id: null, name: 'Cake Box', quantity: 500, unit: 'pcs', min_threshold: 100, cost: 3, sku: 'PKG-BOX-01', type: 'packaging', supplier_id: supRes[2].id, status: 'active' }
  ];\n  `;

const newProdData = `const prodData = [
    // Coffee
    { shop_id: shopId, category_id: getCatId('Coffee'), name: 'Americano (Hot)', price: 50, status: 'active' },
    { shop_id: shopId, category_id: getCatId('Coffee'), name: 'Americano (Iced)', price: 60, status: 'active' },
    { shop_id: shopId, category_id: getCatId('Coffee'), name: 'Latte (Hot)', price: 60, status: 'active' },
    { shop_id: shopId, category_id: getCatId('Coffee'), name: 'Latte (Iced)', price: 70, status: 'active' },
    { shop_id: shopId, category_id: getCatId('Coffee'), name: 'Cappuccino (Hot)', price: 60, status: 'active' },
    { shop_id: shopId, category_id: getCatId('Coffee'), name: 'Cappuccino (Iced)', price: 70, status: 'active' },
    { shop_id: shopId, category_id: getCatId('Coffee'), name: 'Mocha (Hot)', price: 70, status: 'active' },
    { shop_id: shopId, category_id: getCatId('Coffee'), name: 'Mocha (Iced)', price: 80, status: 'active' },
    { shop_id: shopId, category_id: getCatId('Coffee'), name: 'Mocha (Frappe)', price: 95, status: 'active' },
    { shop_id: shopId, category_id: getCatId('Coffee'), name: 'Caramel Macchiato (Iced)', price: 85, status: 'active' },
    { shop_id: shopId, category_id: getCatId('Coffee'), name: 'Hazelnut Latte (Iced)', price: 80, status: 'active' },
    { shop_id: shopId, category_id: getCatId('Coffee'), name: 'Orange Americano (Iced)', price: 85, status: 'active' },
    
    // Tea
    { shop_id: shopId, category_id: getCatId('Tea'), name: 'Thai Tea (Iced)', price: 55, status: 'active' },
    { shop_id: shopId, category_id: getCatId('Tea'), name: 'Thai Tea (Frappe)', price: 70, status: 'active' },
    { shop_id: shopId, category_id: getCatId('Tea'), name: 'Matcha Latte (Iced)', price: 85, status: 'active' },
    { shop_id: shopId, category_id: getCatId('Tea'), name: 'Matcha Latte (Frappe)', price: 100, status: 'active' },
    { shop_id: shopId, category_id: getCatId('Tea'), name: 'Earl Grey Tea (Hot)', price: 50, status: 'active' },
    { shop_id: shopId, category_id: getCatId('Tea'), name: 'Peach Tea (Iced)', price: 65, status: 'active' },
    { shop_id: shopId, category_id: getCatId('Tea'), name: 'Lemon Tea (Iced)', price: 60, status: 'active' },
    
    // Non-Coffee
    { shop_id: shopId, category_id: getCatId('Non-Coffee'), name: 'Fresh Milk (Iced)', price: 50, status: 'active' },
    { shop_id: shopId, category_id: getCatId('Non-Coffee'), name: 'Pink Milk (Iced)', price: 55, status: 'active' },
    { shop_id: shopId, category_id: getCatId('Non-Coffee'), name: 'Caramel Milk (Iced)', price: 65, status: 'active' },
    { shop_id: shopId, category_id: getCatId('Non-Coffee'), name: 'Vanilla Milk (Iced)', price: 65, status: 'active' },
    
    // Cocoa
    { shop_id: shopId, category_id: getCatId('Cocoa'), name: 'Signature Cocoa (Hot)', price: 60, status: 'active' },
    { shop_id: shopId, category_id: getCatId('Cocoa'), name: 'Signature Cocoa (Iced)', price: 70, status: 'active' },
    { shop_id: shopId, category_id: getCatId('Cocoa'), name: 'Signature Cocoa (Frappe)', price: 85, status: 'active' },
    { shop_id: shopId, category_id: getCatId('Cocoa'), name: 'Strawberry Cocoa (Iced)', price: 80, status: 'active' },

    // Smoothie
    { shop_id: shopId, category_id: getCatId('Smoothie'), name: 'Strawberry Smoothie', price: 90, status: 'active' },
    { shop_id: shopId, category_id: getCatId('Smoothie'), name: 'Mango Smoothie', price: 90, status: 'active' },
    { shop_id: shopId, category_id: getCatId('Smoothie'), name: 'Passion Fruit Smoothie', price: 95, status: 'active' },

    // Soda
    { shop_id: shopId, category_id: getCatId('Soda'), name: 'Strawberry Soda', price: 65, status: 'active' },
    { shop_id: shopId, category_id: getCatId('Soda'), name: 'Peach Soda', price: 65, status: 'active' },
    { shop_id: shopId, category_id: getCatId('Soda'), name: 'Blue Hawaii Soda', price: 65, status: 'active' },
    { shop_id: shopId, category_id: getCatId('Soda'), name: 'Red Syrup Soda (Iced)', price: 55, status: 'active' },
    { shop_id: shopId, category_id: getCatId('Soda'), name: 'Lemon Soda', price: 60, status: 'active' },

    // Bakery
    { shop_id: shopId, category_id: getCatId('Bakery'), name: 'Butter Croissant', price: 65, status: 'active' },
    { shop_id: shopId, category_id: getCatId('Bakery'), name: 'Almond Croissant', price: 85, status: 'active' },
    { shop_id: shopId, category_id: getCatId('Bakery'), name: 'Ham Cheese Sandwich', price: 75, status: 'active' },
    { shop_id: shopId, category_id: getCatId('Bakery'), name: 'Fudge Brownie', price: 60, status: 'active' },

    // Cake
    { shop_id: shopId, category_id: getCatId('Cake'), name: 'Chocolate Fudge Cake', price: 120, status: 'active' },
    { shop_id: shopId, category_id: getCatId('Cake'), name: 'New York Cheesecake', price: 140, status: 'active' },
    { shop_id: shopId, category_id: getCatId('Cake'), name: 'Red Velvet Cake', price: 130, status: 'active' }
  ];\n  `;

const newRecipeData = `const addRecipe = (prodName, items) => {
    const pId = prodsRes.find(p => p.name === prodName)?.id;
    if (pId) {
      items.forEach(i => recipeData.push({ product_id: pId, inventory_item_id: i.id, quantity: i.qty, unit: i.unit }));
    }
  };
  
  // Helper to standard recipes
  const addCoffeeIced = (name) => {
    addRecipe(name, [
      { id: getInvId('RAW-TEST-001'), qty: 18, unit: 'g' },
      { id: getInvId('RAW-MILK-001'), qty: 120, unit: 'ml' },
      { id: getInvId('PKG-CUP-16'), qty: 1, unit: 'pcs' },
      { id: getInvId('PKG-LID-01'), qty: 1, unit: 'pcs' },
      { id: getInvId('PKG-STR-01'), qty: 1, unit: 'pcs' }
    ]);
  };

  const addCoffeeHot = (name) => {
    addRecipe(name, [
      { id: getInvId('RAW-TEST-001'), qty: 18, unit: 'g' },
      { id: getInvId('RAW-MILK-001'), qty: 150, unit: 'ml' },
      { id: getInvId('PKG-CUP-08'), qty: 1, unit: 'pcs' },
      { id: getInvId('PKG-LID-02'), qty: 1, unit: 'pcs' }
    ]);
  };

  addRecipe('Americano (Hot)', [
    { id: getInvId('RAW-TEST-001'), qty: 18, unit: 'g' },
    { id: getInvId('PKG-CUP-08'), qty: 1, unit: 'pcs' },
    { id: getInvId('PKG-LID-02'), qty: 1, unit: 'pcs' }
  ]);
  
  addRecipe('Americano (Iced)', [
    { id: getInvId('RAW-TEST-001'), qty: 18, unit: 'g' },
    { id: getInvId('PKG-CUP-16'), qty: 1, unit: 'pcs' },
    { id: getInvId('PKG-LID-01'), qty: 1, unit: 'pcs' },
    { id: getInvId('PKG-STR-01'), qty: 1, unit: 'pcs' }
  ]);

  addCoffeeHot('Latte (Hot)');
  addCoffeeIced('Latte (Iced)');
  addCoffeeHot('Cappuccino (Hot)');
  addCoffeeIced('Cappuccino (Iced)');

  addRecipe('Mocha (Hot)', [
    { id: getInvId('RAW-TEST-001'), qty: 18, unit: 'g' },
    { id: getInvId('RAW-COCOA-001'), qty: 10, unit: 'g' },
    { id: getInvId('RAW-MILK-001'), qty: 150, unit: 'ml' },
    { id: getInvId('PKG-CUP-08'), qty: 1, unit: 'pcs' },
    { id: getInvId('PKG-LID-02'), qty: 1, unit: 'pcs' }
  ]);
  
  addRecipe('Mocha (Iced)', [
    { id: getInvId('RAW-TEST-001'), qty: 18, unit: 'g' },
    { id: getInvId('RAW-COCOA-001'), qty: 15, unit: 'g' },
    { id: getInvId('RAW-MILK-001'), qty: 120, unit: 'ml' },
    { id: getInvId('PKG-CUP-16'), qty: 1, unit: 'pcs' },
    { id: getInvId('PKG-LID-01'), qty: 1, unit: 'pcs' },
    { id: getInvId('PKG-STR-01'), qty: 1, unit: 'pcs' }
  ]);

  addRecipe('Mocha (Frappe)', [
    { id: getInvId('RAW-TEST-001'), qty: 18, unit: 'g' },
    { id: getInvId('RAW-COCOA-001'), qty: 20, unit: 'g' },
    { id: getInvId('RAW-MILK-001'), qty: 100, unit: 'ml' },
    { id: getInvId('PKG-CUP-22'), qty: 1, unit: 'pcs' },
    { id: getInvId('PKG-LID-01'), qty: 1, unit: 'pcs' },
    { id: getInvId('PKG-STR-01'), qty: 1, unit: 'pcs' }
  ]);

  addRecipe('Caramel Macchiato (Iced)', [
    { id: getInvId('RAW-TEST-001'), qty: 18, unit: 'g' },
    { id: getInvId('RAW-SYR-002'), qty: 20, unit: 'ml' },
    { id: getInvId('RAW-MILK-001'), qty: 120, unit: 'ml' },
    { id: getInvId('PKG-CUP-16'), qty: 1, unit: 'pcs' },
    { id: getInvId('PKG-LID-01'), qty: 1, unit: 'pcs' },
    { id: getInvId('PKG-STR-01'), qty: 1, unit: 'pcs' }
  ]);

  addRecipe('Hazelnut Latte (Iced)', [
    { id: getInvId('RAW-TEST-001'), qty: 18, unit: 'g' },
    { id: getInvId('RAW-SYR-003'), qty: 20, unit: 'ml' },
    { id: getInvId('RAW-MILK-001'), qty: 120, unit: 'ml' },
    { id: getInvId('PKG-CUP-16'), qty: 1, unit: 'pcs' },
    { id: getInvId('PKG-LID-01'), qty: 1, unit: 'pcs' },
    { id: getInvId('PKG-STR-01'), qty: 1, unit: 'pcs' }
  ]);

  addRecipe('Orange Americano (Iced)', [
    { id: getInvId('RAW-TEST-001'), qty: 18, unit: 'g' },
    { id: getInvId('RAW-SYR-005'), qty: 30, unit: 'ml' },
    { id: getInvId('PKG-CUP-16'), qty: 1, unit: 'pcs' },
    { id: getInvId('PKG-LID-01'), qty: 1, unit: 'pcs' },
    { id: getInvId('PKG-STR-01'), qty: 1, unit: 'pcs' }
  ]);

  addRecipe('Thai Tea (Iced)', [
    { id: getInvId('RAW-TEA-001'), qty: 15, unit: 'g' },
    { id: getInvId('RAW-MILK-002'), qty: 30, unit: 'ml' },
    { id: getInvId('RAW-MILK-001'), qty: 90, unit: 'ml' },
    { id: getInvId('PKG-CUP-16'), qty: 1, unit: 'pcs' },
    { id: getInvId('PKG-LID-01'), qty: 1, unit: 'pcs' },
    { id: getInvId('PKG-STR-01'), qty: 1, unit: 'pcs' }
  ]);
  
  addRecipe('Thai Tea (Frappe)', [
    { id: getInvId('RAW-TEA-001'), qty: 20, unit: 'g' },
    { id: getInvId('RAW-MILK-002'), qty: 40, unit: 'ml' },
    { id: getInvId('RAW-MILK-001'), qty: 80, unit: 'ml' },
    { id: getInvId('PKG-CUP-22'), qty: 1, unit: 'pcs' },
    { id: getInvId('PKG-LID-01'), qty: 1, unit: 'pcs' },
    { id: getInvId('PKG-STR-01'), qty: 1, unit: 'pcs' }
  ]);

  addRecipe('Matcha Latte (Iced)', [
    { id: getInvId('RAW-TEA-002'), qty: 10, unit: 'g' },
    { id: getInvId('RAW-MILK-002'), qty: 20, unit: 'ml' },
    { id: getInvId('RAW-MILK-001'), qty: 120, unit: 'ml' },
    { id: getInvId('PKG-CUP-16'), qty: 1, unit: 'pcs' },
    { id: getInvId('PKG-LID-01'), qty: 1, unit: 'pcs' },
    { id: getInvId('PKG-STR-01'), qty: 1, unit: 'pcs' }
  ]);
  
  addRecipe('Matcha Latte (Frappe)', [
    { id: getInvId('RAW-TEA-002'), qty: 15, unit: 'g' },
    { id: getInvId('RAW-MILK-002'), qty: 30, unit: 'ml' },
    { id: getInvId('RAW-MILK-001'), qty: 100, unit: 'ml' },
    { id: getInvId('PKG-CUP-22'), qty: 1, unit: 'pcs' },
    { id: getInvId('PKG-LID-01'), qty: 1, unit: 'pcs' },
    { id: getInvId('PKG-STR-01'), qty: 1, unit: 'pcs' }
  ]);

  addRecipe('Earl Grey Tea (Hot)', [
    { id: getInvId('RAW-TEA-003'), qty: 5, unit: 'g' },
    { id: getInvId('PKG-CUP-08'), qty: 1, unit: 'pcs' },
    { id: getInvId('PKG-LID-02'), qty: 1, unit: 'pcs' }
  ]);
  
  addRecipe('Peach Tea (Iced)', [
    { id: getInvId('RAW-TEA-004'), qty: 10, unit: 'g' },
    { id: getInvId('PKG-CUP-16'), qty: 1, unit: 'pcs' },
    { id: getInvId('PKG-LID-01'), qty: 1, unit: 'pcs' },
    { id: getInvId('PKG-STR-01'), qty: 1, unit: 'pcs' }
  ]);
  
  addRecipe('Lemon Tea (Iced)', [
    { id: getInvId('RAW-TEA-003'), qty: 10, unit: 'g' },
    { id: getInvId('RAW-FRT-001'), qty: 20, unit: 'ml' },
    { id: getInvId('PKG-CUP-16'), qty: 1, unit: 'pcs' },
    { id: getInvId('PKG-LID-01'), qty: 1, unit: 'pcs' },
    { id: getInvId('PKG-STR-01'), qty: 1, unit: 'pcs' }
  ]);

  addRecipe('Fresh Milk (Iced)', [
    { id: getInvId('RAW-MILK-001'), qty: 180, unit: 'ml' },
    { id: getInvId('RAW-SYR-001'), qty: 10, unit: 'ml' },
    { id: getInvId('PKG-CUP-16'), qty: 1, unit: 'pcs' },
    { id: getInvId('PKG-LID-01'), qty: 1, unit: 'pcs' },
    { id: getInvId('PKG-STR-01'), qty: 1, unit: 'pcs' }
  ]);
  
  addRecipe('Pink Milk (Iced)', [
    { id: getInvId('RAW-MILK-001'), qty: 150, unit: 'ml' },
    { id: getInvId('RAW-SYR-008'), qty: 30, unit: 'ml' },
    { id: getInvId('PKG-CUP-16'), qty: 1, unit: 'pcs' },
    { id: getInvId('PKG-LID-01'), qty: 1, unit: 'pcs' },
    { id: getInvId('PKG-STR-01'), qty: 1, unit: 'pcs' }
  ]);
  
  addRecipe('Caramel Milk (Iced)', [
    { id: getInvId('RAW-MILK-001'), qty: 150, unit: 'ml' },
    { id: getInvId('RAW-SYR-002'), qty: 30, unit: 'ml' },
    { id: getInvId('PKG-CUP-16'), qty: 1, unit: 'pcs' },
    { id: getInvId('PKG-LID-01'), qty: 1, unit: 'pcs' },
    { id: getInvId('PKG-STR-01'), qty: 1, unit: 'pcs' }
  ]);
  
  addRecipe('Vanilla Milk (Iced)', [
    { id: getInvId('RAW-MILK-001'), qty: 150, unit: 'ml' },
    { id: getInvId('RAW-SYR-001'), qty: 30, unit: 'ml' },
    { id: getInvId('PKG-CUP-16'), qty: 1, unit: 'pcs' },
    { id: getInvId('PKG-LID-01'), qty: 1, unit: 'pcs' },
    { id: getInvId('PKG-STR-01'), qty: 1, unit: 'pcs' }
  ]);

  addRecipe('Signature Cocoa (Hot)', [
    { id: getInvId('RAW-COCOA-001'), qty: 15, unit: 'g' },
    { id: getInvId('RAW-MILK-001'), qty: 150, unit: 'ml' },
    { id: getInvId('PKG-CUP-08'), qty: 1, unit: 'pcs' },
    { id: getInvId('PKG-LID-02'), qty: 1, unit: 'pcs' }
  ]);
  
  addRecipe('Signature Cocoa (Iced)', [
    { id: getInvId('RAW-COCOA-001'), qty: 25, unit: 'g' },
    { id: getInvId('RAW-MILK-001'), qty: 120, unit: 'ml' },
    { id: getInvId('RAW-MILK-002'), qty: 30, unit: 'ml' },
    { id: getInvId('PKG-CUP-16'), qty: 1, unit: 'pcs' },
    { id: getInvId('PKG-LID-01'), qty: 1, unit: 'pcs' },
    { id: getInvId('PKG-STR-01'), qty: 1, unit: 'pcs' }
  ]);
  
  addRecipe('Signature Cocoa (Frappe)', [
    { id: getInvId('RAW-COCOA-001'), qty: 30, unit: 'g' },
    { id: getInvId('RAW-MILK-001'), qty: 100, unit: 'ml' },
    { id: getInvId('RAW-MILK-002'), qty: 40, unit: 'ml' },
    { id: getInvId('PKG-CUP-22'), qty: 1, unit: 'pcs' },
    { id: getInvId('PKG-LID-01'), qty: 1, unit: 'pcs' },
    { id: getInvId('PKG-STR-01'), qty: 1, unit: 'pcs' }
  ]);
  
  addRecipe('Strawberry Cocoa (Iced)', [
    { id: getInvId('RAW-COCOA-001'), qty: 20, unit: 'g' },
    { id: getInvId('RAW-SYR-004'), qty: 20, unit: 'ml' },
    { id: getInvId('RAW-MILK-001'), qty: 120, unit: 'ml' },
    { id: getInvId('PKG-CUP-16'), qty: 1, unit: 'pcs' },
    { id: getInvId('PKG-LID-01'), qty: 1, unit: 'pcs' },
    { id: getInvId('PKG-STR-01'), qty: 1, unit: 'pcs' }
  ]);

  addRecipe('Strawberry Smoothie', [
    { id: getInvId('RAW-SYR-004'), qty: 60, unit: 'ml' },
    { id: getInvId('PKG-CUP-22'), qty: 1, unit: 'pcs' },
    { id: getInvId('PKG-LID-01'), qty: 1, unit: 'pcs' },
    { id: getInvId('PKG-STR-01'), qty: 1, unit: 'pcs' }
  ]);
  
  addRecipe('Mango Smoothie', [
    { id: getInvId('RAW-SYR-005'), qty: 60, unit: 'ml' },
    { id: getInvId('PKG-CUP-22'), qty: 1, unit: 'pcs' },
    { id: getInvId('PKG-LID-01'), qty: 1, unit: 'pcs' },
    { id: getInvId('PKG-STR-01'), qty: 1, unit: 'pcs' }
  ]);
  
  addRecipe('Passion Fruit Smoothie', [
    { id: getInvId('RAW-SYR-006'), qty: 60, unit: 'ml' },
    { id: getInvId('PKG-CUP-22'), qty: 1, unit: 'pcs' },
    { id: getInvId('PKG-LID-01'), qty: 1, unit: 'pcs' },
    { id: getInvId('PKG-STR-01'), qty: 1, unit: 'pcs' }
  ]);

  addRecipe('Strawberry Soda', [
    { id: getInvId('RAW-SYR-004'), qty: 30, unit: 'ml' },
    { id: getInvId('RAW-LIQ-001'), qty: 150, unit: 'ml' },
    { id: getInvId('PKG-CUP-16'), qty: 1, unit: 'pcs' },
    { id: getInvId('PKG-LID-01'), qty: 1, unit: 'pcs' },
    { id: getInvId('PKG-STR-01'), qty: 1, unit: 'pcs' }
  ]);
  
  addRecipe('Peach Soda', [
    { id: getInvId('RAW-TEA-004'), qty: 20, unit: 'g' },
    { id: getInvId('RAW-LIQ-001'), qty: 150, unit: 'ml' },
    { id: getInvId('PKG-CUP-16'), qty: 1, unit: 'pcs' },
    { id: getInvId('PKG-LID-01'), qty: 1, unit: 'pcs' },
    { id: getInvId('PKG-STR-01'), qty: 1, unit: 'pcs' }
  ]);
  
  addRecipe('Blue Hawaii Soda', [
    { id: getInvId('RAW-SYR-007'), qty: 30, unit: 'ml' },
    { id: getInvId('RAW-LIQ-001'), qty: 150, unit: 'ml' },
    { id: getInvId('PKG-CUP-16'), qty: 1, unit: 'pcs' },
    { id: getInvId('PKG-LID-01'), qty: 1, unit: 'pcs' },
    { id: getInvId('PKG-STR-01'), qty: 1, unit: 'pcs' }
  ]);
  
  addRecipe('Red Syrup Soda (Iced)', [
    { id: getInvId('RAW-SYR-008'), qty: 40, unit: 'ml' },
    { id: getInvId('RAW-LIQ-001'), qty: 150, unit: 'ml' },
    { id: getInvId('PKG-CUP-16'), qty: 1, unit: 'pcs' },
    { id: getInvId('PKG-LID-01'), qty: 1, unit: 'pcs' },
    { id: getInvId('PKG-STR-01'), qty: 1, unit: 'pcs' }
  ]);
  
  addRecipe('Lemon Soda', [
    { id: getInvId('RAW-FRT-001'), qty: 30, unit: 'ml' },
    { id: getInvId('RAW-LIQ-001'), qty: 150, unit: 'ml' },
    { id: getInvId('PKG-CUP-16'), qty: 1, unit: 'pcs' },
    { id: getInvId('PKG-LID-01'), qty: 1, unit: 'pcs' },
    { id: getInvId('PKG-STR-01'), qty: 1, unit: 'pcs' }
  ]);

  addRecipe('Butter Croissant', [
    { id: getInvId('RAW-BAK-001'), qty: 1, unit: 'pcs' },
    { id: getInvId('PKG-BAG-01'), qty: 1, unit: 'pcs' }
  ]);
  
  addRecipe('Almond Croissant', [
    { id: getInvId('RAW-BAK-002'), qty: 1, unit: 'pcs' },
    { id: getInvId('PKG-BAG-01'), qty: 1, unit: 'pcs' }
  ]);
  
  addRecipe('Ham Cheese Sandwich', [
    { id: getInvId('RAW-FOOD-001'), qty: 1, unit: 'pcs' },
    { id: getInvId('PKG-BAG-01'), qty: 1, unit: 'pcs' }
  ]);
  
  addRecipe('Fudge Brownie', [
    { id: getInvId('RAW-BAK-003'), qty: 1, unit: 'pcs' },
    { id: getInvId('PKG-BOX-01'), qty: 1, unit: 'pcs' }
  ]);

  addRecipe('Chocolate Fudge Cake', [
    { id: getInvId('RAW-CAK-001'), qty: 1, unit: 'pcs' },
    { id: getInvId('PKG-BOX-01'), qty: 1, unit: 'pcs' }
  ]);
  
  addRecipe('New York Cheesecake', [
    { id: getInvId('RAW-CAK-002'), qty: 1, unit: 'pcs' },
    { id: getInvId('PKG-BOX-01'), qty: 1, unit: 'pcs' }
  ]);
  
  addRecipe('Red Velvet Cake', [
    { id: getInvId('RAW-CAK-003'), qty: 1, unit: 'pcs' },
    { id: getInvId('PKG-BOX-01'), qty: 1, unit: 'pcs' }
  ];\n`;

c = c.replace(getBlock('const invData = [', 'const { data: invRes }'), newInvData + '\n  ');
c = c.replace(getBlock('const prodData = [', 'const { data: prodsRes }'), newProdData + '\n  ');
c = c.replace(getBlock('const addRecipe = (prodName, items) => {', 'if(recipeData.length > 0) {'), newRecipeData + '\n  ');

fs.writeFileSync('seed.js', c, 'utf8');
console.log("Rewrite complete.");
