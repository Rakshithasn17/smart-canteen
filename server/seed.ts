
import db from './database'

const foods = [
  {
    id: 1,
    name: 'Masala Dosa',
    category: 'Meals',
    price: 40,
    description: 'Crispy dosa with potato masala',
    prep_time: 8,
    image: 'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&w=700&q=80',
  },
  {
    id: 2,
    name: 'Idli Sambar',
    category: 'Meals',
    price: 30,
    description: 'Soft idlis with fresh sambar',
    prep_time: 5,
    image: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=700&q=80',
  },
  {
    id: 3,
    name: 'Veg Sandwich',
    category: 'Meals',
    price: 50,
    description: 'Toasted sandwich with fresh vegetables',
    prep_time: 6,
    image: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=700&q=80',
  },
  {
    id: 4,
    name: 'Hot Coffee',
    category: 'Drinks',
    price: 20,
    description: 'Freshly brewed campus coffee',
    prep_time: 3,
    image: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=700&q=80',
  },
  {
    id: 5,
    name: 'Masala Tea',
    category: 'Drinks',
    price: 15,
    description: 'Warm tea with aromatic spices',
    prep_time: 2,
    image: 'https://images.unsplash.com/photo-1571934811356-5cc061b6821f?auto=format&fit=crop&w=700&q=80',
  },
  {
    id: 6,
    name: 'Potato Chips',
    category: 'Quick Bites',
    price: 20,
    description: 'A crunchy, ready-to-go snack',
    prep_time: 0,
    image: 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&w=700&q=80',
  },
  {
    id: 7,
    name: 'Chocolate Biscuits',
    category: 'Quick Bites',
    price: 10,
    description: 'A little treat between classes',
    prep_time: 0,
    image: 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?auto=format&fit=crop&w=700&q=80',
  },
  {
    id: 8,
    name: 'Cold Water',
    category: 'Quick Bites',
    price: 20,
    description: 'A refreshing bottle of water',
    prep_time: 0,
    image: 'https://images.unsplash.com/photo-1560023907-5f339617ea30?auto=format&fit=crop&w=700&q=80',
  },
]

const insert = db.prepare(`
  INSERT OR IGNORE INTO menu_items
    (id, name, category, price, description, prep_time, image)
  VALUES
    (@id, @name, @category, @price, @description, @prep_time, @image)
`)

const seed = db.transaction(() => {
  for (const food of foods) {
    insert.run(food)
  }
})

seed()

console.log('Menu seeded successfully!')
console.log('Total menu items:', db.prepare('SELECT COUNT(*) AS count FROM menu_items').get())
