import { Transaction } from '../types/store.types';

export const MOCK_TRANSACTIONS: Transaction[] = [
    // Transactions for Card 1 (Visa)
    {
        id: 't1',
        paymentMethodId: '1',
        title: 'Oil Change',
        shopName: 'Union Square Motors',
        amount: '$129.00',
        date: 'April 24',
        iconName: 'droplet',
        iconColor: '#FACC15',
    },
    {
        id: 't2',
        paymentMethodId: '1',
        title: 'Brake Fluid Flush',
        shopName: 'Atelier Motors',
        amount: '$279.00',
        date: 'April 18',
        iconName: 'percent',
        iconColor: '#9CA3AF',
    },
    {
        id: 't3',
        paymentMethodId: '1',
        title: 'Wheel Alignment',
        shopName: 'South Bay Motors',
        amount: '$279.00',
        date: 'April 12',
        iconName: 'target',
        iconColor: '#9CA3AF',
    },
    
    // Transactions for Card 2 (Mastercard)
    {
        id: 't4',
        paymentMethodId: '2',
        title: 'Tire Rotation',
        shopName: 'Discount Tires',
        amount: '$45.00',
        date: 'March 15',
        iconName: 'car',
        iconColor: '#60A5FA',
    },
    {
        id: 't5',
        paymentMethodId: '2',
        title: 'Engine Diagnostic',
        shopName: 'Precision Auto',
        amount: '$150.00',
        date: 'March 10',
        iconName: 'wrench',
        iconColor: '#9CA3AF',
    },
    
    // Transactions for Card 3 (Amex)
    {
        id: 't6',
        paymentMethodId: '3',
        title: 'Car Wash',
        shopName: 'Sparkle Clean',
        amount: '$25.00',
        date: 'May 02',
        iconName: 'droplet',
        iconColor: '#60A5FA',
    },
    {
        id: 't7',
        paymentMethodId: '3',
        title: 'Full Detailing',
        shopName: 'Luxe Auto Care',
        amount: '$199.00',
        date: 'May 01',
        iconName: 'car',
        iconColor: '#FACC15',
    }
];
