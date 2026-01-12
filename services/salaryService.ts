
import { Skill, UserSkill, SkillStatus, MonthlyBonus, QualityIncident } from '../types';

interface SalaryCalculationResult {
  total: number;
  nextMonthTotal: number;
  breakdown: {
    base: number;
    skills: number;
    monthly: number;
    details: {
      activeSkills: { name: string; amount: number; isBlocked?: boolean; effectiveFrom?: string; status: 'active'|'pending_month'|'blocked' }[];
      pendingSkills: { name: string; amount: number; effectiveFrom?: string; }[]; // New breakdown field
      bonuses: MonthlyBonus;
    }
  }
}

export const calculateSalary = (
  baseRate: number,
  allSkills: Skill[],
  userSkills: UserSkill[],
  monthlyBonus: MonthlyBonus,
  referenceDate: Date = new Date(),
  qualityIncidents: QualityIncident[] = [] // New parameter
): SalaryCalculationResult => {
  
  // 1. Setup Dates
  const currentYear = referenceDate.getFullYear();
  const currentMonth = referenceDate.getMonth();
  const startOfCurrentMonth = new Date(currentYear, currentMonth, 1);
  
  // 2. Calculate Skill Bonuses
  let currentSkillsBonus = 0;
  let nextMonthSkillsBonus = 0;
  
  const activeSkillDetails: { name: string; amount: number; isBlocked?: boolean; effectiveFrom?: string; status: 'active'|'pending_month'|'blocked' }[] = [];
  const pendingSkillDetails: { name: string; amount: number; effectiveFrom?: string; }[] = [];

  userSkills.forEach(us => {
    // Defense: Skip null/undefined records
    if (!us) return;

    // Only CONFIRMED skills potentially count AND must NOT be archived
    if (us.status === SkillStatus.CONFIRMED && !us.is_archived) {
      const skill = allSkills.find(s => s && s.id === us.skill_id);
      
      const bonusAmount = skill ? skill.hourly_bonus : (us.bonus_value || 0);
      const name = us.custom_name || (skill ? skill.name_pl : 'Nieznana umiejętność');

      if (bonusAmount > 0) {
        // --- LOGIC: EFFECTIVE DATE ---
        let effectiveDate: Date;
        if (us.effective_from) {
            effectiveDate = new Date(us.effective_from);
        } else if (us.confirmed_at) {
            const confirmedDate = new Date(us.confirmed_at);
            // Default rule: 1st of Next Month after confirmation
            effectiveDate = new Date(confirmedDate.getFullYear(), confirmedDate.getMonth() + 1, 1);
        } else {
            effectiveDate = new Date(0); // Assume historical if missing
        }

        // --- LOGIC: QUALITY BLOCK (Based on Incidents in current month) ---
        const incidentsCount = qualityIncidents.filter(inc => {
            if (!inc) return false;
            const incDate = new Date(inc.date);
            return inc.user_id === us.user_id && 
                   inc.skill_id === us.skill_id &&
                   incDate.getMonth() === currentMonth &&
                   incDate.getFullYear() === currentYear;
        }).length;

        const isQualityBlocked = incidentsCount >= 2;

        // --- CURRENT RATE CALCULATION ---
        let status: 'active' | 'pending_month' | 'blocked' = 'active';
        
        if (effectiveDate <= startOfCurrentMonth) {
            if (isQualityBlocked) {
                status = 'blocked';
            } else {
                currentSkillsBonus += bonusAmount;
                status = 'active';
            }
            
            activeSkillDetails.push({ 
                name, 
                amount: bonusAmount, 
                isBlocked: isQualityBlocked, 
                effectiveFrom: effectiveDate.toISOString(),
                status
            });

        } else {
            status = 'pending_month';
            pendingSkillDetails.push({
                name,
                amount: bonusAmount,
                effectiveFrom: effectiveDate.toISOString()
            });
        }

        nextMonthSkillsBonus += bonusAmount;
      }
    }
  });

  // 3. Calculate Monthly Bonuses
  let monthlyBonusAmount = 0;
  if (monthlyBonus?.kontrola_pracownikow) monthlyBonusAmount += 1.5;
  if (monthlyBonus?.realizacja_planu) monthlyBonusAmount += 1.0;
  if (monthlyBonus?.brak_usterek) monthlyBonusAmount += 1.0;
  if (monthlyBonus?.brak_naduzyc_materialowych) monthlyBonusAmount += 0.5;
  
  const seniorityBonus = (monthlyBonus?.staz_pracy_years || 0) * 0.2;
  monthlyBonusAmount += seniorityBonus;

  const currentTotal = baseRate + currentSkillsBonus + monthlyBonusAmount;
  const nextTotal = baseRate + nextMonthSkillsBonus + monthlyBonusAmount;

  return {
    total: parseFloat(currentTotal.toFixed(2)),
    nextMonthTotal: parseFloat(nextTotal.toFixed(2)),
    breakdown: {
      base: baseRate,
      skills: currentSkillsBonus,
      monthly: monthlyBonusAmount,
      details: {
        activeSkills: activeSkillDetails,
        pendingSkills: pendingSkillDetails,
        bonuses: monthlyBonus
      }
    }
  };
};
