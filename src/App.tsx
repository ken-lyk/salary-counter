import { useState, useMemo, useEffect, useRef } from 'react';
import './App.css';

const TICK_INTERVAL_MS = 100;

// Calculation constants
const DAYS_IN_YEAR = 365.25;
const WORK_DAYS_IN_YEAR = 260; // 52 weeks * 5 days

function App() {
    const [monthlyIncome, setMonthlyIncome] = useState('5000');
    const [running, setRunning] = useState(false);
    const [earned, setEarned] = useState(0);
    const [ytdEarnings, setYtdEarnings] = useState(0);
    const [includeWeekends, setIncludeWeekends] = useState(true); // Default to 7-day week
    const [hourSchedule, setHourSchedule] = useState(24); // Default to 24 hours
    const [currency, setCurrency] = useState('SGD'); // Default to SGD

    const intervalRef = useRef<number | null>(null);
    const lastTickTimeRef = useRef<number | null>(null);

    const rates = useMemo(() => {
        const numericIncome = parseFloat(monthlyIncome);
        if (isNaN(numericIncome) || numericIncome <= 0) {
            return { perDay: 0, perHour: 0, perMinute: 0, perSecond: 0 };
        }

        const annualIncome = numericIncome * 12;
        const daysPerYear = includeWeekends ? DAYS_IN_YEAR : WORK_DAYS_IN_YEAR;
        const totalEarningSecondsInYear = daysPerYear * hourSchedule * 3600;

        const perSecond = totalEarningSecondsInYear > 0 ? annualIncome / totalEarningSecondsInYear : 0;
        const perMinute = perSecond * 60;
        const perHour = perMinute * 60;
        const perDay = perHour * hourSchedule;

        return { perDay, perHour, perMinute, perSecond };
    }, [monthlyIncome, includeWeekends, hourSchedule]);

    

    // Effect to initialize and update the base YTD earnings
    useEffect(() => {
        if (rates.perSecond === 0) {
            setYtdEarnings(0);
            return;
        }

        const now = new Date();
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        const totalCalendarSecondsPassed = (now.getTime() - startOfYear.getTime()) / 1000;

        let effectiveEarningSecondsPassed = totalCalendarSecondsPassed;

        if (!includeWeekends) {
            effectiveEarningSecondsPassed *= (WORK_DAYS_IN_YEAR / DAYS_IN_YEAR);
        }
        if (hourSchedule !== 24) {
            effectiveEarningSecondsPassed *= (hourSchedule / 24);
        }

        setYtdEarnings(effectiveEarningSecondsPassed * rates.perSecond);
    }, [rates, includeWeekends, hourSchedule]);

    const progressPercentages = useMemo(() => {
        const numericIncome = parseFloat(monthlyIncome);
        if (numericIncome <= 0) return { daily: 0, monthly: 0, yearly: 0 };

        const annualIncome = numericIncome * 12;

        const now = new Date();

        // Daily progress
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const secondsSinceMidnight = (now.getTime() - startOfDay.getTime()) / 1000;

        let secondsIntoWorkday = 0;
        if (hourSchedule === 24) {
            secondsIntoWorkday = secondsSinceMidnight;
        } else { // 8 or 9 hour schedule
            const workdayStartHour = 9; // Assuming 9 AM start
            const workdayEndHour = workdayStartHour + hourSchedule;
            const currentHour = now.getHours();
            const currentMinute = now.getMinutes();
            const currentSecond = now.getSeconds();

            if (currentHour < workdayStartHour) {
                secondsIntoWorkday = 0;
            } else if (currentHour >= workdayEndHour) {
                secondsIntoWorkday = hourSchedule * 3600; // Full day earned
            } else {
                secondsIntoWorkday = (currentHour - workdayStartHour) * 3600 + currentMinute * 60 + currentSecond;
            }
        }
        const earnedToday = secondsIntoWorkday * rates.perSecond;
        const daily = (earnedToday / rates.perDay) * 100;

        // Monthly progress
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const totalCalendarSecondsPassedMonth = (now.getTime() - startOfMonth.getTime()) / 1000;
        let effectiveMonthlySecondsPassed = totalCalendarSecondsPassedMonth;

        if (!includeWeekends) {
            effectiveMonthlySecondsPassed *= (WORK_DAYS_IN_YEAR / DAYS_IN_YEAR);
        }
        if (hourSchedule !== 24) {
            effectiveMonthlySecondsPassed *= (hourSchedule / 24);
        }
        const earnedThisMonth = effectiveMonthlySecondsPassed * rates.perSecond;
        const monthly = (earnedThisMonth / numericIncome) * 100;

        // Yearly progress
        const yearly = (ytdEarnings / annualIncome) * 100;

        return { daily, monthly, yearly };

    }, [ytdEarnings, monthlyIncome, includeWeekends, hourSchedule, rates]);

    // Effect for the running counters
    useEffect(() => {
        if (running) {
            lastTickTimeRef.current = Date.now();
            intervalRef.current = window.setInterval(() => {
                const now = Date.now();
                const delta = now - (lastTickTimeRef.current ?? now);
                lastTickTimeRef.current = now;
                const earnedThisTick = (delta / 1000) * rates.perSecond;
                setEarned(prevEarned => prevEarned + earnedThisTick);
                setYtdEarnings(prevYtd => prevYtd + earnedThisTick);
            }, TICK_INTERVAL_MS);
        } else if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [running, rates.perSecond]);

    const handleStartStop = () => {
        if (!running && rates.perSecond === 0) {
            alert('Please enter a valid monthly income.');
            return;
        }
        setRunning(!running);
    };

    const handleReset = () => {
        setRunning(false);
        setEarned(0);
    };

    return (
        <div className="app-container">
            <div className="content-wrapper">
                <h1>Salary Counter</h1>

                <div className="ytd-display">
                    <div>Year-to-Date Earnings</div>
                    <span>{new Intl.NumberFormat('en-US', { style: 'currency', currency: currency }).format(ytdEarnings)}</span>
                </div>

                <div className="counter-display" title="Session Earnings">{new Intl.NumberFormat('en-US', { style: 'currency', currency: currency, minimumFractionDigits: 6 }).format(earned)}</div>

                <div className="progress-container">
                    <div className="progress-label">Daily Goal: {progressPercentages.daily.toFixed(2)}%</div>
                    <div className="progress-bar">
                        <div className="progress-bar-fill" style={{ width: `${Math.min(progressPercentages.daily, 100)}%` }}></div>
                    </div>
                    <div className="progress-label">Monthly Goal: {progressPercentages.monthly.toFixed(2)}%</div>
                    <div className="progress-bar">
                        <div className="progress-bar-fill" style={{ width: `${Math.min(progressPercentages.monthly, 100)}%` }}></div>
                    </div>
                    <div className="progress-label">Yearly Goal: {progressPercentages.yearly.toFixed(2)}%</div>
                    <div className="progress-bar">
                        <div className="progress-bar-fill" style={{ width: `${Math.min(progressPercentages.yearly, 100)}%` }}></div>
                    </div>
                </div>

                <div className="rates-display">
                    <div className="rate-item"><strong>Per Day:</strong> {new Intl.NumberFormat('en-US', { style: 'currency', currency: currency }).format(rates.perDay)}</div>
                    <div className="rate-item"><strong>Per Hour:</strong> {new Intl.NumberFormat('en-US', { style: 'currency', currency: currency }).format(rates.perHour)}</div>
                    <div className="rate-item"><strong>Per Minute:</strong> {new Intl.NumberFormat('en-US', { style: 'currency', currency: currency }).format(rates.perMinute)}</div>
                </div>

                <div className="controls-wrapper">
                    <div className="controls-grid">
                        <input
                            type="number"
                            className="salary-input"
                            placeholder="Monthly Income"
                            value={monthlyIncome}
                            onChange={(e) => setMonthlyIncome(e.target.value)}
                            disabled={running}
                        />
                        <div className="toggle-container">
                            <label htmlFor="weekends-toggle">Work Week</label>
                            <select id="weekends-toggle" className='select-control' value={includeWeekends.toString()} onChange={(e) => setIncludeWeekends(e.target.value === 'true')} disabled={running}>
                                <option value="true">7 Days</option>
                                <option value="false">5 Days</option>
                            </select>
                        </div>
                        <div className="toggle-container">
                            <label htmlFor="hours-toggle">Work Hours</label>
                            <select id="hours-toggle" className='select-control' value={hourSchedule} onChange={(e) => setHourSchedule(Number(e.target.value))} disabled={running}>
                                <option value="24">24 Hours</option>
                                <option value="9">9 Hours</option>
                                <option value="8">8 Hours</option>
                            </select>
                        </div>
                        
                        <div className="toggle-container">
                            <label htmlFor="currency-select">Currency</label>
                            <select id="currency-select" className='select-control' value={currency} onChange={(e) => setCurrency(e.target.value)} disabled={running}>
                                <option value="AUD">AUD</option>
                                <option value="CAD">CAD</option>
                                <option value="CHF">CHF</option>
                                <option value="CNY">CNY</option>
                                <option value="EUR">EUR</option>
                                <option value="GBP">GBP</option>
                                <option value="HKD">HKD</option>
                                <option value="IDR">IDR</option>
                                <option value="INR">INR</option>
                                <option value="JPY">JPY</option>
                                <option value="KRW">KRW</option>
                                <option value="MYR">MYR</option>
                                <option value="PHP">PHP</option>
                                <option value="SGD">SGD</option>
                                <option value="THB">THB</option>
                                <option value="TWD">TWD</option>
                                <option value="USD">USD</option>
                                <option value="VND">VND</option>
                            </select>
                        </div>
                    </div>
                    <div className="button-group">
                        <button className={`btn ${running ? 'btn-stop' : 'btn-start'}`} onClick={handleStartStop}>
                            {running ? 'Stop' : 'Start'}
                        </button>
                        <button className="btn btn-reset" onClick={handleReset}>
                            Reset
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default App;
