import { get } from '@/lib/api';
import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';

export enum TransactionType {
  CREDIT = 'CREDIT',
  DEBIT = 'DEBIT',
  TRANSFER = 'TRANSFER',
}

export enum TransactionStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  REVERSED = 'REVERSED',
}

interface Transaction {
  id: string;
  type: TransactionType;
  status: TransactionStatus;
  amount: number;
  description: string;
  createdAt: string;
  /** Only manual top-up rows carry a UTR; everything else comes back null. */
  transaction_utr?: string | null;
}

interface WalletState {
  balance: number;
  loading: boolean;
  error: string | null;
  isPendingTxn: boolean;
  transactions: Transaction[];
}

interface WalletAPIResponse {
  walletType: 'PREPAID' | 'POSTPAID';
  balance: number;
  creditLimit: number;
  isActive: boolean;
  transactions: Transaction[];
}

const initialState: WalletState = {
  loading: true,
  error: null,
  balance: 0,
  isPendingTxn: false,
  transactions: [],
};

export const fetchWalletBalance = createAsyncThunk<
  WalletAPIResponse,
  void,
  { rejectValue: string | null }
>('wallet/fetchBalance', async (_, thunkAPI) => {
  try {
    const balanceData = await get('/api/v1/user/get-wallet');
    return balanceData?.responseData;
  } catch (error: unknown) {
    return thunkAPI.rejectWithValue(error instanceof Error ? error.message : 'Unknown error');
  }
});

export const walletSlice = createSlice({
  name: 'wallet',
  initialState,
  reducers: {
    setBalance: (state, action: PayloadAction<number>) => {
      state.balance = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchWalletBalance.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(
        fetchWalletBalance.fulfilled,
        (state, action: PayloadAction<WalletAPIResponse>) => {
          state.loading = false;
          state.balance = Number(action.payload.balance);
          state.transactions = action.payload.transactions || [];
          state.isPendingTxn =
            action.payload.transactions?.some((t) => t.status === 'PENDING') ||
            false;
        },
      )
      .addCase(fetchWalletBalance.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || 'Failed to fetch balance';
      });
  },
});

export const { setBalance } = walletSlice.actions;
export default walletSlice.reducer;
