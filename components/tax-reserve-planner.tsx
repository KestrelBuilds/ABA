"use client";
import { useState } from "react";
import { Calculator } from "lucide-react";
import type { DbProject, WorkspaceData } from "@/lib/workspace";
import { workspaceInsights } from "@/lib/workspace-insights";
import { taxReserve } from "@/lib/tax-reserve";
import { pounds } from "@/lib/finance/money";

function ProjectReserve({
  project,
  percentage,
  onPercentage,
}: {
  project: DbProject;
  percentage: string;
  onPercentage: (value: string) => void;
}) {
  const [income, setIncome] = useState(String(project.budget));
  const [costs, setCosts] = useState("0");
  const result = taxReserve(income, costs, percentage);
  return (
    <>
      <div className="tax-planner-inputs">
        <label>
          Project income before VAT (£)
          <input
            type="number"
            inputMode="decimal"
            min="0"
            max="10000000"
            step="0.01"
            value={income}
            onChange={(event) => setIncome(event.target.value)}
          />
        </label>
        <label>
          Estimated allowable project costs (£)
          <input
            type="number"
            inputMode="decimal"
            min="0"
            max="10000000"
            step="0.01"
            value={costs}
            onChange={(event) => setCosts(event.target.value)}
          />
        </label>
        <label>
          Your planning reserve (%)
          <input
            type="number"
            inputMode="decimal"
            min="0"
            max="100"
            step="0.01"
            placeholder="Choose a percentage"
            value={percentage}
            onChange={(event) => onPercentage(event.target.value)}
          />
        </label>
      </div>
      <p className="helper-note">
        Income starts from the full saved project value, not only payments
        received. Check it excludes VAT if applicable, then enter your expected
        allowable costs. Zero costs are assumed until you change them.
      </p>
      <div aria-live="polite" role="status">
        {result.ok ? (
          <>
            <dl className="tax-planner-results">
              <div>
                <dt>
                  {result.profit < 0 ? "Projected loss" : "Projected profit"}
                </dt>
                <dd>{pounds(result.profit)}</dd>
              </div>
              <div className="tax-reserve-total">
                <dt>Set aside at {result.percentage}%</dt>
                <dd>{pounds(result.reserve)}</dd>
              </div>
              <div>
                <dt>Profit after this reserve</dt>
                <dd>{pounds(result.balance)}</dd>
              </div>
            </dl>
            {result.profit < 0 && (
              <p>
                This project shows a loss, so this calculation reserves £0. Tax
                may still be due on your other annual profits or income.
              </p>
            )}
          </>
        ) : (
          <p className="helper-note">{result.message}</p>
        )}
      </div>
    </>
  );
}

export default function TaxReservePlanner({ data }: { data: WorkspaceData }) {
  const [projectId, setProjectId] = useState("");
  const [percentage, setPercentage] = useState("");
  if (data.role !== "admin") return null;
  const projects = workspaceInsights(data).projects;
  const project = projects.find((p) => p.id === projectId) ?? projects[0];
  return (
    <section
      className="panel tax-reserve-planner"
      aria-label="Tax reserve planner"
    >
      <header className="section-heading">
        <div>
          <span className="section-kicker">SOLE TRADER PLANNING</span>
          <h2>Tax reserve planner</h2>
        </div>
        <Calculator size={24} aria-hidden="true" />
      </header>
      <p>
        Sole-trader tax depends on annual profit, other income, allowances and
        National Insurance. There is no fixed tax percentage for each project.
        Use a planning percentage you choose to estimate what to set aside.
      </p>
      {project ? (
        <>
          <label className="tax-project-picker">
            Project for this estimate
            <select
              aria-label="Project for this estimate"
              value={project.id}
              onChange={(event) => setProjectId(event.target.value)}
            >
              {projects.map((p) => (
                <option value={p.id} key={p.id}>
                  {data.clients.find((c) => c.id === p.client_id)?.name} —{" "}
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <ProjectReserve
            key={project.id}
            project={project}
            percentage={percentage}
            onPercentage={setPercentage}
          />
        </>
      ) : (
        <p>Add a project to plan its reserve.</p>
      )}
      <p className="tax-planner-note">
        This is a cash-planning estimate, not your tax bill or an HMRC rate.
        Check your percentage and allowable costs with your accountant. These
        inputs are not saved and do not change project values, payment checks or
        invoices.
      </p>
      <a
        href="https://www.gov.uk/income-tax-rates"
        className="resource"
        target="_blank"
        rel="noreferrer"
      >
        HMRC Income Tax rates and allowances ↗
      </a>
    </section>
  );
}
