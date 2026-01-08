import { useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';

const companies = ['Amazon', 'Costco', 'Walmart', 'Macy\'s'];
const years = ['2018', '2019', '2020', '2021', '2022', '2023', '2024'];

const SampleApp = () => {
  const [selectedCompany, setSelectedCompany] = useState('');
  const [selectedYear, setSelectedYear] = useState('');

  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <div className="w-full max-w-md space-y-6 rounded-lg border border-border bg-card p-8 shadow-lg">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">Sample Selection</h1>
          <p className="text-sm text-muted-foreground">
            Select a company and year from the dropdowns below
          </p>
        </div>

        <div className="space-y-4">
          {/* Company Dropdown */}
          <div className="space-y-2">
            <Label htmlFor="company-select">Company</Label>
            <Select value={selectedCompany} onValueChange={setSelectedCompany}>
              <SelectTrigger id="company-select">
                <SelectValue placeholder="Select a company" />
              </SelectTrigger>
              <SelectContent>
                {companies.map((company) => (
                  <SelectItem key={company} value={company}>
                    {company}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Year Dropdown */}
          <div className="space-y-2">
            <Label htmlFor="year-select">Year</Label>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger id="year-select">
                <SelectValue placeholder="Select a year" />
              </SelectTrigger>
              <SelectContent>
                {years.map((year) => (
                  <SelectItem key={year} value={year}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Display selected values */}
        {(selectedCompany || selectedYear) && (
          <div className="rounded-md border border-border bg-muted p-4">
            <h2 className="mb-2 text-sm font-semibold text-foreground">Selected:</h2>
            <div className="space-y-1 text-sm text-muted-foreground">
              {selectedCompany && (
                <p>
                  <span className="font-medium">Company:</span> {selectedCompany}
                </p>
              )}
              {selectedYear && (
                <p>
                  <span className="font-medium">Year:</span> {selectedYear}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SampleApp;
