// services/categories.js
export const PLANT_CATEGORIES = [
  { id: 'all', label: 'All Plants', icon: 'flower-outline', value: 'All Plants', description: 'Browse all available plants' },
  { id: 'indoor', label: 'Indoor', icon: 'home', value: 'Indoor Plants', description: 'Plants suitable for indoor environments' },
  { id: 'outdoor', label: 'Outdoor', icon: 'tree', value: 'Outdoor Plants', description: 'Plants ideal for gardens and outdoor spaces' },
  { id: 'succulent', label: 'Succulents', icon: 'cactus', value: 'Succulents', description: 'Water-storing succulent varieties' },
  { id: 'cactus', label: 'Cacti', icon: 'cactus', value: 'Cacti', description: 'Various types of cacti' },
  { id: 'flowering', label: 'Flowering', icon: 'flower', value: 'Flowering Plants', description: 'Plants known for their beautiful blooms' },
  { id: 'herbs', label: 'Herbs', icon: 'leaf', value: 'Herbs', description: 'Culinary and medicinal herbs' },
  { id: 'vegetable', label: 'Vegetables', icon: 'sprout', value: 'Vegetable Plants', description: 'Edible plants and vegetables' },
  { id: 'tropical', label: 'Tropical', icon: 'palm-tree', value: 'Tropical Plants', description: 'Exotic plants from tropical regions' },
  { id: 'seeds', label: 'Seeds', icon: 'seed-outline', value: 'Seeds', description: 'Seeds for growing your own plants' },
  { id: 'accessories', label: 'Accessories', icon: 'pot-mix-outline', value: 'Accessories', description: 'Pots, soil, and other plant accessories' },
  { id: 'tools', label: 'Tools', icon: 'tools', value: 'Tools', description: 'Gardening tools and equipment' }
];
export const getCategoryFilterOptions = () => {
  return PLANT_CATEGORIES.map(cat => ({ id: cat.id, label: cat.label, icon: cat.icon }));
};
export const getAddPlantCategories = () => {
  return PLANT_CATEGORIES.filter(cat => cat.id !== 'all').map(cat => cat.value);
};
export const getCategorySelectOptions = () => {
  return PLANT_CATEGORIES.map(cat => ({ label: cat.label, value: cat.id }));
};
export const getCategoryNameById = (categoryId) => {
  const category = PLANT_CATEGORIES.find(cat => cat.id === categoryId);
  return category ? category.value : 'Other';
};
export const getCategoryIdByName = (categoryName) => {
  const category = PLANT_CATEGORIES.find(cat => cat.value.toLowerCase() === categoryName.toLowerCase());
  return category ? category.id : 'other';
};
export default {
  PLANT_CATEGORIES,
  getCategoryFilterOptions,
  getAddPlantCategories,
  getCategorySelectOptions,
  getCategoryNameById,
  getCategoryIdByName
};