
import React from 'react';
import { Timetable, TimetableEntry, Day, TimeSlot } from '@/utils/types';
import { formatTeacherNames, normalizeTeacherData } from '@/utils/facultyLabUtils';
import MultiTeacherDisplay from './MultiTeacherDisplay';

/**
 * Interface defining the props required by the TimetableView component
 * @property {Timetable} timetable - The timetable data to be displayed
 * @property {string} facultyFilter - Optional filter to show only entries for a specific faculty member
 * @property {boolean} printMode - Optional flag to adjust styling for print layout
 */
interface TimetableViewProps {
  timetable: Timetable;
  facultyFilter?: string;
  printMode?: boolean;
}

/**
 * TimetableView Component
 * 
 * This component renders a complete timetable grid with days as columns and time slots as rows.
 * It handles various display scenarios including:
 * - Regular subject entries
 * - Lab sessions (which may span multiple time slots)
 * - Break and lunch periods
 * - Free periods
 * - Faculty-specific filtered views
 * 
 * The component intelligently determines which days to display based on the year and configuration,
 * and properly formats entries with teacher information and batch details when applicable.
 */
const TimetableView: React.FC<TimetableViewProps> = ({ timetable, facultyFilter, printMode }) => {
  // Define standard days and time slots for the timetable grid
  const days: Day[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const timeSlots: TimeSlot[] = [
    '9:30-10:20', 
    '10:20-11:10', 
    '11:10-11:20', // Break
    '11:20-12:10', 
    '12:10-1:00', 
    '1:00-2:00',   // Lunch
    '2:00-2:50', 
    '2:50-3:40', 
    '3:40-4:30'
  ];
  
  // Determine which days to show based on year and dayOptions
  let visibleDays: Day[];
  
  if (timetable.formData.year === '4th Year') {
    // For 4th year, use the selected day options
    visibleDays = timetable.formData.dayOptions.useCustomDays 
      ? timetable.formData.dayOptions.selectedDays
      : timetable.formData.dayOptions.fourContinuousDays 
        ? ['Monday', 'Tuesday', 'Wednesday', 'Thursday']
        : days;
  } else {
    // For 1st to 3rd year, always use all 6 days
    visibleDays = days;
  }
  
  // Filter entries for faculty view if needed
  const entries = facultyFilter
    ? timetable.entries.filter(entry => entry.teacherName === facultyFilter)
    : timetable.entries;
  
  /**
   * Helper function to get a specific timetable entry for a day and time slot
   * @param day - The day to check
   * @param timeSlot - The time slot to check
   * @returns The matching timetable entry or undefined if none exists
   */
  const getEntry = (day: Day, timeSlot: TimeSlot): TimetableEntry | undefined => {
    return entries.find(entry => entry.day === day && entry.timeSlot === timeSlot);
  };

  /**
   * Function to get all lab entries with the same lab group ID
   * Used for displaying related lab sessions (e.g., for batch rotations)
   * @param labGroupId - The lab group identifier
   * @returns Array of timetable entries in the same lab group
   */
  const getLabEntries = (labGroupId: string): TimetableEntry[] => {
    return entries.filter(entry => entry.labGroupId === labGroupId);
  };

  /**
   * Special helper to check if a time slot contains lab entries
   * Handles lab time slots that span multiple regular slots (e.g., 9:30-1:00)
   * @param day - The day to check
   * @param timeSlot - The specific time slot to check
   * @returns Array of lab entries that include this time slot
   */
  const getLabsForTimeSlot = (day: Day, timeSlot: TimeSlot): TimetableEntry[] => {
    // First check for lab entries that span multiple slots (like 9:30-1:00)
    const labEntries = entries.filter(entry => 
      entry.day === day && 
      (entry.timeSlot === '9:30-1:00' || entry.timeSlot === '2:00-4:30') &&
      (entry.isLab || entry.isLabGroup) &&
      // Check if the current timeSlot falls within the lab's time range
      ((entry.timeSlot === '9:30-1:00' && 
        ['9:30-10:20', '10:20-11:10', '11:20-12:10', '12:10-1:00'].includes(timeSlot)) ||
       (entry.timeSlot === '2:00-4:30' && 
        ['2:00-2:50', '2:50-3:40', '3:40-4:30'].includes(timeSlot)))
    );
    
    return labEntries;
  };
  
  /**
   * Function to render the content for each timetable cell
   * Handles different types of entries (regular subjects, labs, breaks, etc.)
   * @param day - The day for this cell
   * @param timeSlot - The time slot for this cell
   * @returns JSX for the cell content
   */
  const renderCellContent = (day: Day, timeSlot: TimeSlot) => {
    // First check for breaks and lunch
    if (timeSlot === '11:10-11:20') {
      return <div className="font-medium text-muted-foreground italic">Break</div>;
    }
    
    if (timeSlot === '1:00-2:00') {
      return <div className="font-medium text-muted-foreground italic">Lunch</div>;
    }
    
    // Check for lab entries that span multiple time slots
    const labEntries = getLabsForTimeSlot(day, timeSlot);
    if (labEntries.length > 0) {
      // Check if these are lab group entries (for batch rotation)
      const labGroupIds = [...new Set(labEntries.map(entry => entry.labGroupId).filter(Boolean))];
      
      if (labGroupIds.length > 0) {
        // Display lab rotation (multiple batches in the same slot)
        return (
          <div className="text-sm bg-green-100 p-1 rounded">
            {labGroupIds.map(groupId => {
              const groupEntries = getLabEntries(groupId!);
              return (
                <React.Fragment key={groupId}>
                  {groupEntries.map((lab, idx) => {
                    const normalizedEntry = normalizeTeacherData(lab);
                    return (
                      <React.Fragment key={idx}>
                        {idx > 0 && <div className="my-1 border-t border-dashed" />}
                        <div className="font-medium">{lab.subjectName}</div>
                        <MultiTeacherDisplay entry={normalizedEntry} />
                        {lab.batchNumber && <div className="text-xs text-primary">({lab.batchNumber})</div>}
                      </React.Fragment>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </div>
        );
      } else {
        // Display individual lab entries
        return (
          <div className="text-sm bg-green-100 p-1 rounded">
            {labEntries.map((lab, idx) => {
              const normalizedEntry = normalizeTeacherData(lab);
              return (
                <React.Fragment key={idx}>
                  {idx > 0 && <div className="my-1 border-t border-dashed" />}
                  <div className="font-medium">{lab.subjectName}</div>
                  <MultiTeacherDisplay entry={normalizedEntry} />
                  {lab.batchNumber && <div className="text-xs text-primary">({lab.batchNumber})</div>}
                </React.Fragment>
              );
            })}
          </div>
        );
      }
    }
    
    // Now check for normal entries
    const entry = getEntry(day, timeSlot);
    
    if (!entry) return null;
    
    // Handle free periods with custom types
    if (entry.isFree) {
      let freeType = entry.freeType;
      if (entry.freeType === 'Others' && entry.customFreeType) {
        freeType = entry.customFreeType;
      }
      return <div className="italic text-blue-600">{freeType}</div>;
    }
    
    // For regular subjects
    if (entry.subjectName) {
      const normalizedEntry = normalizeTeacherData(entry);
      return (
        <div>
          <div className="font-medium">{entry.subjectName}</div>
          <MultiTeacherDisplay entry={normalizedEntry} />
          {entry.batchNumber && (
            <div className="text-xs text-primary">({entry.batchNumber})</div>
          )}
        </div>
      );
    }
    
    // Empty cell
    return null;
  };
  
  // Debug function to check if there are lab entries
  const debugLabEntries = () => {
    const labEntries = entries.filter(entry => entry.isLab || entry.isLabGroup);
    console.log('Lab entries found:', labEntries.length, labEntries);
  };
  
  // Call the debug function on component mount
  React.useEffect(() => {
    debugLabEntries();
  }, [entries]);

  // Render the timetable grid with days as columns and time slots as rows
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse border">
        <thead>
          <tr className={`${printMode ? 'bg-gray-100' : 'bg-muted'}`}>
            <th className="border p-2 text-sm font-medium">Time / Day</th>
            {visibleDays.map(day => (
              <th key={day} className="border p-2 text-sm font-medium">
                {day}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {timeSlots.map((timeSlot) => {
            const isBreakOrLunch = timeSlot === '11:10-11:20' || timeSlot === '1:00-2:00';
            
            return (
              <tr 
                key={timeSlot} 
                className={isBreakOrLunch ? 'bg-gray-100' : ''}
              >
                <td className="border p-2 text-sm font-medium whitespace-nowrap">
                  {timeSlot}
                </td>
                {visibleDays.map(day => (
                  <td 
                    key={`${day}-${timeSlot}`} 
                    className={`border p-2 text-center ${isBreakOrLunch ? 'bg-gray-100' : ''}`}
                  >
                    {renderCellContent(day, timeSlot)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default TimetableView;
