'use client';

import { motion, type Variants } from 'framer-motion';
import { ProfileInformationCard } from './ProfileInformationCard';
import { LocationOverviewCard } from './LocationOverviewCard';
import { ChangePasswordCard } from './ChangePasswordCard';
import { LoginHistoryCard } from './LoginHistoryCard';
import DashboardTitle from '@/components/common/DashboardTitle';
import TransactionHistory from '@/components/pages/transactionHistory/TransactionHistory';

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.1 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] },
  },
};

const Profile = () => {
  return (
    <motion.div
      className="space-y-4 px-2 sm:space-y-6 sm:px-0"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.div variants={itemVariants}>
        <DashboardTitle
          title="Commercial Profile"
          subTitle="Manage your account and view activity"
        />
      </motion.div>

      <motion.div
        variants={itemVariants}
        className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2"
      >
        <ProfileInformationCard />
        <LocationOverviewCard />
      </motion.div>

      <motion.div variants={itemVariants}>
        <ChangePasswordCard />
      </motion.div>

      <motion.div variants={itemVariants}>
        <LoginHistoryCard />
      </motion.div>

      <motion.div variants={itemVariants}>
        <TransactionHistory />
      </motion.div>
    </motion.div>
  );
};

export default Profile;