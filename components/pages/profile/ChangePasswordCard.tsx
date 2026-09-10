'use client';

import { useState } from 'react';
import { KeyRound, Mail, Shield, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FormProvider, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { FormInput } from '@/components/ui/form-input';
import { RootState } from '@/redux/store';
import { useDispatch, useSelector } from 'react-redux';
import { post } from '@/lib/api';
import { toast } from 'sonner';
import { logout } from '@/redux/userSlice';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import ForgotMpinPanel from './sub/ForgotMpinPanel';

const changeEmailSchema = z
  .object({
    newEmail: z.string().email('Please enter a valid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z
      .string()
      .min(6, 'Password must be at least 6 characters'),
    otp: z.string().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

type ChangeEmailFormValues = z.infer<typeof changeEmailSchema>;

export const ChangePasswordCard = () => {
  const [emailQrCode, setEmailQrCode] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>('mpin');

  const [changeEmailLoading, setChangeEmailLoading] = useState<boolean>(false);

  const email = useSelector(
    (state: RootState) => state?.user?.user?.email ?? '',
  );

  const emailForm = useForm<ChangeEmailFormValues>({
    resolver: zodResolver(changeEmailSchema),
    defaultValues: {
      newEmail: '',
      password: '',
      confirmPassword: '',
      otp: '',
    },
  });

  const [showQr, setShowQr] = useState<string>('');
  const [modalOpen, setModalOpen] = useState<boolean>(false);

  const handleEmailChange = async (data: ChangeEmailFormValues) => {
    setChangeEmailLoading(true);

    const payload = {
      email,
      ...data,
    };

    try {
      const res = await post('/api/auth/change-email', payload);

      if (res.responseData?.require_otp) {
        setEmailQrCode(true);
        toast.warning('Please enter OTP from the authenticator.');
      } else {
        setShowQr(res.responseData?.qr_code);
        setModalOpen(true);
        toast.success('Email changed successfully');
        emailForm.reset();
      }
    } catch (error) {
      toast.error('Error changing email');
    } finally {
      setChangeEmailLoading(false);
    }
  };

  const dispatch = useDispatch();
  const router = useRouter();
  const handleModalClose = () => {
    dispatch(logout());
    router.replace('/auth');
  };

  const tabContentVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
    exit: { opacity: 0, y: -10, transition: { duration: 0.2 } },
  };

  return (
    <>
      <Card className="rounded-xl border-slate-800 bg-slate-900/50 backdrop-blur-xl">
        <CardHeader className="px-4 pb-3 pt-4 sm:px-6 sm:pb-4 sm:pt-6">
          <CardTitle className="flex items-center gap-2 text-sm text-emerald-400 sm:text-base">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 sm:h-8 sm:w-8 sm:rounded-xl">
              <Shield className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </div>
            Account Security
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6">
          <Tabs
            defaultValue="mpin"
            className="w-full"
            onValueChange={setActiveTab}
          >
            <TabsList className="mb-4 grid w-full grid-cols-2 gap-1 rounded-xl border border-slate-800 bg-slate-900/50 p-1 sm:mb-6 sm:gap-2">
              <TabsTrigger
                value="mpin"
                className="flex items-center justify-center gap-1.5 rounded-xl border-0 px-2 py-2 text-xs font-semibold transition-all duration-300 data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-400 sm:gap-2 sm:px-4 sm:text-sm"
              >
                <KeyRound className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                MPIN
              </TabsTrigger>
              <TabsTrigger
                value="email"
                className="flex items-center justify-center gap-1.5 rounded-xl border-0 px-2 py-2 text-xs font-semibold transition-all duration-300 data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-400 sm:gap-2 sm:px-4 sm:text-sm"
              >
                <Mail className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                Email
              </TabsTrigger>
            </TabsList>

            <TabsContent value="mpin" className="mt-0">
              <motion.div
                key="mpin-tab"
                variants={tabContentVariants}
                initial="hidden"
                animate="visible"
              >
                <ForgotMpinPanel />
              </motion.div>
            </TabsContent>

            <TabsContent value="email" className="mt-0">
              <motion.div
                key="email-tab"
                variants={tabContentVariants}
                initial="hidden"
                animate="visible"
              >
                <div className="mb-3 flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 sm:mb-4 sm:gap-3 sm:p-4">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 sm:h-8 sm:w-8 sm:rounded-xl">
                    <AlertCircle className="h-3.5 w-3.5 text-amber-400 sm:h-4 sm:w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-300 sm:text-sm">
                      Important Notice
                    </p>
                    <p className="mt-0.5 text-[10px] leading-relaxed text-slate-500 sm:mt-1 sm:text-xs">
                      Changing your email will require you to verify the new
                      email address. You will be logged out after the change.
                    </p>
                  </div>
                </div>

                <FormProvider {...emailForm}>
                  <form
                    onSubmit={emailForm.handleSubmit(handleEmailChange)}
                    className="space-y-4"
                  >
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                      <FormInput
                        form={emailForm}
                        name="password"
                        label="Password"
                        type="password"
                        placeholder="Enter your password"
                      />

                      <FormInput
                        form={emailForm}
                        name="confirmPassword"
                        label="Confirm Password"
                        type="password"
                        placeholder="Confirm your password"
                      />
                      <FormInput
                        form={emailForm}
                        name="newEmail"
                        label="New Email"
                        type="email"
                        placeholder="Enter your new email address"
                      />

                      {emailQrCode && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                        >
                          <FormInput
                            form={emailForm}
                            name="otp"
                            label="OTP"
                            type="text"
                            placeholder="Enter OTP from authenticator"
                          />
                        </motion.div>
                      )}
                    </div>

                    <Button
                      type="submit"
                      loading={changeEmailLoading}
                      className="mt-2"
                    >
                      <Mail className="mr-2 h-4 w-4" />
                      Update Email
                    </Button>
                  </form>
                </FormProvider>
              </motion.div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </>
  );
};
