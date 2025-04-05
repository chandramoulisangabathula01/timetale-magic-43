
import React, { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { getTimetables, isTeacherAvailable } from "@/utils/timetableUtils";
import { 
  TimetableEntry, 
  SubjectTeacherPair, 
  Day, 
  TimeSlot, 
  FreeHourType,
  YearType,
  BranchType
} from '@/utils/types';

/**
 * ManualSchedulingGrid Component
 * 
 * A React component that provides a grid interface for manual timetable scheduling.
 * Allows users to assign subjects, teachers, and free hours to specific time slots.
 * Handles teacher conflicts and maintains schedule consistency.
 */

interface ManualSchedulingGridProps {
  // List of subject-teacher pairs available for scheduling
  subjectTeacherPairs: SubjectTeacherPair[];
  // Year of the timetable
  year: YearType;
  // Optional existing entries for editing mode
  initialEntries?: TimetableEntry[];
  // Callback when entries change
  onEntriesChange: (entries: TimetableEntry[]) => void;
  // Available free hour types (optional with default)
  freeHours?: { type: FreeHourType, customType?: string }[];
  // Configuration for days of the week (optional with default)
  dayOptions?: { 
    fourContinuousDays: boolean;
    useCustomDays: boolean;
    selectedDays: Day[];
  };
  // Branch/Department (optional)
  branch?: BranchType;
}

const ManualSchedulingGrid: React.FC<ManualSchedulingGridProps> = ({ 
  subjectTeacherPairs, 
  year,
  initialEntries = [],
  onEntriesChange,
  freeHours = [
    { type: 'Library' as FreeHourType },
    { type: 'Sports' as FreeHourType },
    { type: 'Project' as FreeHourType }
  ],
  dayOptions = {
    fourContinuousDays: false,
    useCustomDays: false,
    selectedDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday'] as Day[]
  },
  branch
}) => {
  const [entries, setEntries] = useState<TimetableEntry[]>([]);
  const { toast } = useToast();
  
  // Dynamic day selection based on year and options
  let days: Day[];
  
  if (year === '4th Year') {
    // Special handling for 4th year schedule
    days = dayOptions.useCustomDays 
      ? dayOptions.selectedDays     // Use custom selected days
      : dayOptions.fourContinuousDays 
        ? ['Monday', 'Tuesday', 'Wednesday', 'Thursday'] as Day[]  // 4 continuous days
        : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as Day[];  // Full week
  } else {
    // Regular 6-day schedule for other years
    days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as Day[];
  }
    
  // Define standard time slots with breaks and lunch
  const timeSlots: TimeSlot[] = [
    '9:30-10:20',   // 1st period
    '10:20-11:10',  // 2nd period
    '11:10-11:20',  // Morning break
    '11:20-12:10',  // 3rd period
    '12:10-1:00',   // 4th period
    '1:00-2:00',    // Lunch break
    '2:00-2:50',    // 5th period
    '2:50-3:40',    // 6th period
    '3:40-4:30',    // 7th period
    '4:30-5:20'     // 8th period
  ];
  
  // Time slot order mapping for sorting and comparison
  const timeOrder: Record<TimeSlot, number> = {
    '9:30-10:20': 0,
    '10:20-11:10': 1,
    '11:10-11:20': 2,  // Break
    '11:20-12:10': 3,
    '12:10-1:00': 4,
    '1:00-2:00': 5,    // Lunch
    '2:00-2:50': 6,
    '2:50-3:40': 7,
    '3:40-4:30': 8,
    '4:30-5:20': 9,
    // Special slots for lab sessions
    '9:30-1:00': 10,
    '10:20-1:00': 11,
    '2:00-4:30': 12
  };
  
  // Initialize grid entries from existing data or create empty grid
  useEffect(() => {
    if (initialEntries && initialEntries.length > 0) {
      console.log("Using existing entries:", initialEntries.length);
      
      // Filter entries to match current day selection
      const filteredEntries = initialEntries.filter(entry => days.includes(entry.day));
      
      const initialGridEntries: TimetableEntry[] = [];
      
      // Create grid with existing entries or empty slots
      days.forEach(day => {
        timeSlots.forEach(timeSlot => {
          const existingEntry = filteredEntries.find(
            entry => entry.day === day && entry.timeSlot === timeSlot
          );
          
          if (existingEntry) {
            initialGridEntries.push(existingEntry);
          } else {
            initialGridEntries.push({
              day,
              timeSlot,
              // Empty slot
            });
          }
        });
      });
      
      setEntries(initialGridEntries);
      return;
    }
    
    // Create empty grid if no existing entries
    const initialGridEntries: TimetableEntry[] = [];
    
    days.forEach(day => {
      timeSlots.forEach(timeSlot => {
        initialGridEntries.push({
          day,
          timeSlot,
          // Empty slot
        });
      });
    });
    
    setEntries(initialGridEntries);
  }, [initialEntries, days, year, dayOptions]);
  
  // Save entries whenever they change
  useEffect(() => {
    if (entries.length > 0) {
      onEntriesChange(entries);
    }
  }, [entries, onEntriesChange]);

  // Check for teacher scheduling conflicts
  const checkTeacherConflicts = (day: Day, timeSlot: TimeSlot, teacherName: string): boolean => {
    // Check conflicts in current timetable
    const conflictInCurrentTimetable = entries.some(entry => 
      entry.day === day && 
      entry.timeSlot === timeSlot && 
      entry.teacherName === teacherName &&
      !entry.isBreak &&
      !entry.isLunch
    );

    if (conflictInCurrentTimetable) {
      return true;
    }
    
    // Check conflicts in other timetables
    return !isTeacherAvailable(teacherName, day, timeSlot);
  };
  
  // Handle changes to grid cells (subject or free hour assignment)
  const handleCellChange = (day: Day, timeSlot: TimeSlot, value: string, type: 'subject' | 'free') => {
    console.log("Handling cell change:", { day, timeSlot, value, type });
    
    if (type === 'subject') {
      // Handle subject assignment
      const [subjectId, teacherName] = value.split('|');
      const subject = subjectTeacherPairs.find(s => s.id === subjectId);
      
      if (subject) {
        // Check for teacher conflicts
        if (checkTeacherConflicts(day, timeSlot, subject.teacherName)) {
          toast({
            title: "Scheduling Conflict",
            description: `${subject.teacherName} already has a class scheduled at this time slot in another class.`,
            variant: "destructive"
          });
          return;
        }
        
        // Update entries with new subject
        setEntries(prevEntries => {
          const newEntries = prevEntries.map(entry => {
            if (entry.day === day && entry.timeSlot === timeSlot) {
              return {
                ...entry,
                subjectName: subject.subjectName,
                teacherName: subject.teacherName,
                isLab: subject.isLab,
                batchNumber: subject.batchNumber,
                isFree: false,
                freeType: undefined
              };
            }
            return entry;
          });
          
          // Show success toast
          setTimeout(() => {
            toast({
              title: "Subject Assigned",
              description: `${subject.subjectName} with ${subject.teacherName} has been assigned to this slot.`,
              variant: "default"
            });
          }, 100);
          
          return newEntries;
        });
      }
    } else if (type === 'free') {
      // Handle free hour assignment
      setEntries(prevEntries => {
        const newEntries = prevEntries.map(entry => {
          if (entry.day === day && entry.timeSlot === timeSlot) {
            return {
              ...entry,
              subjectName: undefined,
              teacherName: undefined,
              isLab: false,
              batchNumber: undefined,
              isFree: true,
              freeType: value as FreeHourType
            };
          }
          return entry;
        });
        
        // Show success toast
        setTimeout(() => {
          toast({
            title: "Free Hour Added",
            description: `${value} has been added to this slot.`,
            variant: "default"
          });
        }, 100);
        
        return newEntries;
      });
    }
  };
  
  // Clear a cell's contents
  const handleClearCell = (day: Day, timeSlot: TimeSlot) => {
    setEntries(prevEntries => {
      const newEntries = prevEntries.map(entry => {
        if (entry.day === day && entry.timeSlot === timeSlot) {
          return {
            day,
            timeSlot,
            // Reset all properties
          };
        }
        return entry;
      });
      
      toast({
        title: "Cell Cleared",
        description: "This time slot has been cleared.",
        variant: "default"
      });
      
      return newEntries;
    });
  };
  
  // Get entry for a specific day and time slot
  const getEntry = (day: Day, timeSlot: TimeSlot): TimetableEntry | undefined => {
    return entries.find(entry => entry.day === day && entry.timeSlot === timeSlot);
  };
  
  // Check if a time slot is a break or lunch period
  const isSpecialTimeSlot = (timeSlot: TimeSlot): boolean => {
    return timeSlot === '11:10-11:20' || timeSlot === '1:00-2:00';
  };
  
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse border">
        <thead>
          <tr className="bg-muted">
            <th className="border p-2 text-sm font-medium">Time / Day</th>
            {days.map(day => (
              <th key={day} className="border p-2 text-sm font-medium">
                {day}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {timeSlots.map((timeSlot) => (
            <tr 
              key={timeSlot} 
              className={`
                ${timeSlot === '11:10-11:20' ? 'bg-gray-100' : ''} 
                ${timeSlot === '1:00-2:00' ? 'bg-gray-100' : ''}
              `}
            >
              <td className="border p-2 text-sm font-medium whitespace-nowrap">
                {timeSlot}
              </td>
              {days.map(day => (
                <td key={`${day}-${timeSlot}`} className="border p-2">
                  {timeSlot === '11:10-11:20' ? (
                    <div className="text-center text-sm font-medium text-muted-foreground italic">Break</div>
                  ) : timeSlot === '1:00-2:00' ? (
                    <div className="text-center text-sm font-medium text-muted-foreground italic">Lunch</div>
                  ) : (
                    <div className="space-y-2">
                      {getEntry(day, timeSlot)?.subjectName && (
                        <div className={`p-1 rounded text-sm ${getEntry(day, timeSlot)?.isLab ? 'bg-green-50' : ''}`}>
                          <div className="font-medium">{getEntry(day, timeSlot)?.subjectName}</div>
                          <div className="text-xs text-muted-foreground">{getEntry(day, timeSlot)?.teacherName}</div>
                          {getEntry(day, timeSlot)?.batchNumber && (
                            <div className="text-xs text-primary">({getEntry(day, timeSlot)?.batchNumber})</div>
                          )}
                        </div>
                      )}
                      
                      {getEntry(day, timeSlot)?.isFree && getEntry(day, timeSlot)?.freeType && (
                        <div className="p-1 rounded bg-blue-50 text-sm">
                          <div className="italic text-blue-600">{getEntry(day, timeSlot)?.freeType}</div>
                        </div>
                      )}
                      
                      <Select
                        onValueChange={(value) => handleCellChange(day, timeSlot, value, 'subject')}
                        value=""
                      >
                        <SelectTrigger className="text-xs h-8">
                          <SelectValue placeholder="Assign subject" />
                        </SelectTrigger>
                        <SelectContent>
                          {subjectTeacherPairs && subjectTeacherPairs.map((pair) => (
                            <SelectItem key={pair.id} value={`${pair.id}|${pair.teacherName}`}>
                              {pair.subjectName} ({pair.teacherName})
                              {pair.isLab && pair.batchNumber && ` (${pair.batchNumber})`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      
                      <Select
                        onValueChange={(value) => handleCellChange(day, timeSlot, value, 'free')}
                        value=""
                      >
                        <SelectTrigger className="text-xs h-8">
                          <SelectValue placeholder="Assign free hour" />
                        </SelectTrigger>
                        <SelectContent>
                          {freeHours.map((freeHour, index) => (
                            <SelectItem 
                              key={index} 
                              value={freeHour.type === 'Others' && freeHour.customType 
                                ? freeHour.customType 
                                : freeHour.type
                              }
                            >
                              {freeHour.type === 'Others' && freeHour.customType 
                                ? freeHour.customType 
                                : freeHour.type
                              }
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      
                      {(getEntry(day, timeSlot)?.subjectName || getEntry(day, timeSlot)?.isFree) && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="w-full h-6 text-xs"
                          onClick={() => handleClearCell(day, timeSlot)}
                        >
                          Clear
                        </Button>
                      )}
                    </div>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ManualSchedulingGrid;
