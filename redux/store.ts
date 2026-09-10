import { configureStore, combineReducers } from '@reduxjs/toolkit';
import { persistStore } from 'redux-persist';
import userReducer from './userSlice';
import infoReducer from './infoSlice';
import walletReducer from './walletSlice';
import { getPersistedReducer } from './persistConfig';

const rootReducer = combineReducers({
  user: userReducer,
  info: infoReducer,
  wallet: walletReducer,
});

const persistedReducer = getPersistedReducer(rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});

export const persistor = persistStore(store);

export type RootState = ReturnType<typeof rootReducer>;
export type AppDispatch = typeof store.dispatch;
