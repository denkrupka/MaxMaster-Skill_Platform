
import React from 'react';
import { CandidateProfilePage } from '../candidate/Profile';

// Reusing the robust Candidate Profile which handles data editing, password change, etc.
// Logic inside CandidateProfile adapts to UserStatus/Role.
export const EmployeeProfile = () => {
    return <CandidateProfilePage />;
};
