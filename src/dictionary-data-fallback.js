module.exports = {
  RD000:
  { CAMPUS_EMAIL: { short_description: 'Email', long_description: '' },
  DEPT_DESCR:
  { short_description: 'Primary Department',
  long_description: 'The department associated with the primary appointment for the investigator.' },
  PRIMARY_FIRST_NAME: { short_description: 'First Name', long_description: '' },
  PRIMARY_LAST_NAME: { short_description: 'Last Name', long_description: '' },
  RESEARCHER_NETID: { short_description: 'NetID', long_description: '' }
},
RD001:
{
  CURRENT_PROPOSAL_STATUS:
  { short_description: 'Proposal Status',
  long_description: 'The status of the proposal. Possible values can include: Awarded (awarded but available for OSR edit), Awarded QA Check Complete (awarded and locked after QA check), Delete (inactive award/proposal in system), In Development, JIT/Revisions Requested, Negotiated Pending Administrative (administrative issues must be completed before full contract execution), Negotiated Pending Sponsor Execution (all issues are resolved – awaiting receipt of fully-executed agreement from sponsor)' },
  DATE_SUBMITTED:
  { short_description: 'Date Submitted',
  long_description: 'Date proposal was submitted from OSR' },
  INSTITUTION_NUMBER:
  { short_description: 'Institution #',
  long_description: 'Institution number is the front end proposal number used to uniquely identify each proposal' },
  MAIN_PI: { short_description: 'Lead PI', long_description: '' },
  PROJECT_REQUEST_END_DATE:
  { short_description: 'Projected Period End',
  long_description: 'The requested project period end date for a proposal' },
  PROJECT_REQUEST_START_DATE:
  { short_description: 'Projected Period Start',
  long_description: 'The requested project period start date for a proposal' },
  PROPOSAL_TITLE: { short_description: 'Proposal Title', long_description: '' },
  SPONSOR:
  { short_description: 'Project Sponsor',
  long_description: 'Organization providing funds for the proposed project' }
},

RD002:
{
  PROJECT_NAME: { short_description: 'Project ', long_description: '' },
  BALANCE: { short_description: 'Balance', long_description: '' },
  DEPARTMENT_DESCRIPTION:
  { short_description: 'Originating Department',
  long_description: '' },
  FUND_CODE: { short_description: 'Chart String', long_description: '' }
},

RD003: {
  BALANCE: { short_description: 'Total Cost Balance', long_description: 'Balance including all costs except restricted'},
  PRIMARY_PROJECT_ID: { short_description: 'Project ID', long_description: '' },
  PRIMARY_ROLE:
  { short_description: 'Role on Project',
  long_description: 'The role associated with an investigator for an award' },
  PROJECT_END_DATE:
  { short_description: 'Project End Date',
  long_description: 'Date project project will end' },
  PROJECT_NAME: { short_description: 'Project Name', long_description: '' },
  SPONSOR:
  { short_description: 'Project Sponsor',
  long_description: 'Organization providing funds for the proposed project' }
},
RD004:
{
  NET_BALANCE:
  { short_description: 'Net Balance',
  long_description: 'Position relative to revenue and expenses' }
},
RD005:
{
  ACCOUNT_DESCR: { short_description: 'Category', long_description: '' },
  ENCUMBERED: { short_description: 'Encumbered Expense', long_description: 'Expenses in the system that have not been paid, but will be at a future date' },
  EXPENSE_BUDGET_BALANCE:
  { short_description: 'Balance',
  long_description: 'Funds remaining in the budget after subtracting actual expenses and encumberances' },
  FYTD_ACTUAL_EXPENSE: { short_description: 'Actual Expense', long_description: '' }
},
RD006:
{
  'CARRY FORWARD ALLOWED':
  { short_description: 'Carry Over Allowed',
  long_description: 'Funds are automatically allowed to carryover to following year' }
},

RD007:
{
  ACCOUNT_CATEGORY_DESCRIPTION: { short_description: 'Category', long_description: '' },
  ACTUAL: { short_description: 'Actual Expenses', long_description: '' },
  BALANCE: { short_description: 'Balance', long_description: '' },
  BUDGET: { short_description: 'Budget', long_description: '' },
  ENCUMBERED: { short_description: 'Encumbered', long_description: '' }
},
RD008:
{
  'ACCOUNT CATEGORY DESCR': { short_description: 'Category', long_description: '' }
},
RD010:
{
  'Account Code':
  { short_description: 'Account',
  long_description: 'Internal budget account number' },
  'Account Description':
  { short_description: 'Account Description',
  long_description: '' },
  Amount: { short_description: 'Amount', long_description: '' },
  'Date':
  { short_description: 'Transaction Date',
  long_description: 'Date transaction was paid. Also known as the GL Post Date' },
  Description:
  { short_description: 'Transaction Description',
  long_description: 'Description of the transaction as entered into the system' },
  'Transaction ID':
  { short_description: 'Reference #',
  long_description: 'Internal transaction number assigned' }
}
}
