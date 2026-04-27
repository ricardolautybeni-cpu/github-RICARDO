import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import PosScreen from './src/screens/PosScreen';
import ClientHistoryScreen from './src/screens/ClientHistoryScreen';

const Stack = createStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Pos">
        <Stack.Screen
          name="Pos"
          component={PosScreen}
          options={{ title: 'Punto de Venta' }}
        />
        <Stack.Screen
          name="ClientHistory"
          component={ClientHistoryScreen}
          options={{ title: 'Historial del Cliente' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
