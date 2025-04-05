import React, { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { AlertTriangle, AlertCircle, Plus, Trash2, InfoIcon } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { 
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from "@/components/ui/tabs";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from '@/hooks/use-toast';
import { 
  YearType, 
  SemesterType, 
  BranchType, 
  Day, 
  FreeHourType, 
  SubjectTeacherPair,
  TimetableFormData,
  Timetable,
  TimetableEntry
} from '@/utils/types';
import { generateTimetable, saveTimetable, countNonLabSubjectsForTeacher, doesTimetableExist } from '@/utils/timetableUtils';
import { getFaculty } from '@/utils/facultyUtils';
import { getFilteredSubjects, subjectTeacherPairExists } from '@/utils/subjectsUtils';
import { isFacultyAvailableForSubjects, validateSubjectTeacherPairs } from '@/utils/facultyWorkloadUtils';
import ManualSchedulingGrid from '@/components/ManualSchedulingGrid';

interface CreateTimetableFormProps {
  existingTimetable?: Timetable;
  initialMode?: 'auto' | 'manual';
}

const CreateTimetableForm: React.FC<CreateTimetableFormProps> = ({ existingTimetable, initialMode = 'auto' }) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const isEditMode = !!existingTimetable;
  
  const [schedulingMode, setSchedulingMode] = useState<'auto' | 'manual'>(initialMode);
  
  const [formData, setFormData] = useState<TimetableFormData>(
    existingTimetable?.formData || {
      year: '1st Year' as YearType,
      semester: 'I' as SemesterType,
      branch: 'CSE' as BranchType,
      department: 'Computer Science',
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0],
      customBranch: '',
      courseName: 'B.Tech',
      roomNumber: '',
      academicYear: '',
      classInchargeName: '',
      mobileNumber: '',
      date: new Date().toISOString().split('T')[0],
      subjectTeacherPairs: [],
      freeHours: [
        { type: 'Library' as FreeHourType }
      ],
      dayOptions: {
        fourContinuousDays: false,
        useCustomDays: false,
        selectedDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday'] as Day[]
      },
      enableBatchRotation: true,
      fourthYearSixDays: false
    }
  );
  
  const [availableSubjects, setAvailableSubjects] = useState([]);
  const [availableFaculty, setAvailableFaculty] = useState([]);
  
  const [newSubject, setNewSubject] = useState('');
  const [newTeacher, setNewTeacher] = useState('');
  const [newTeacher2, setNewTeacher2] = useState('');
  const [isLabSubject, setIsLabSubject] = useState(false);
  const [multipleTeachers, setMultipleTeachers] = useState(false);
  const [batchNumber, setBatchNumber] = useState('');
  
  const [newFreeHourType, setNewFreeHourType] = useState<FreeHourType>('Library');
  const [customFreeHourType, setCustomFreeHourType] = useState('');
  const [mergeFreeSlots, setMergeFreeSlots] = useState(false);
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [currentStep, setCurrentStep] = useState(0);
  
  const [manualTimetableEntries, setManualTimetableEntries] = useState<TimetableEntry[]>([]);
  
  const [manualEntriesInitialized, setManualEntriesInitialized] = useState(false);
  
  const [facultyWorkload, setFacultyWorkload] = useState({});
  
  useEffect(() => {
    const faculty = getFaculty();
    
    const workloadInfo = {};
    faculty.forEach(f => {
      const { isAvailable, currentCount } = isFacultyAvailableForSubjects(f.name);
      workloadInfo[f.name] = {
        currentCount,
        isAvailable,
        remainingCapacity: Math.max(0, 3 - currentCount)
      };
    });
    
    setFacultyWorkload(workloadInfo);
    setAvailableFaculty(faculty);
  }, []);

  useEffect(() => {
    if (formData.year && formData.branch) {
      setAvailableSubjects(getFilteredSubjects(
        formData.year, 
        formData.branch, 
        formData.branch === 'Other' ? formData.customBranch : undefined
      ));
    }
  }, [formData.year, formData.branch, formData.customBranch]);

  useEffect(() => {
    if (isEditMode && existingTimetable && !manualEntriesInitialized) {
      setManualTimetableEntries(existingTimetable.entries);
      setManualEntriesInitialized(true);
      
      if (existingTimetable.entries.length > 0) {
        setSchedulingMode('manual');
      }
    }
  }, [isEditMode, existingTimetable, manualEntriesInitialized]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
    
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
    
    if (name === 'year' || name === 'branch' || name === 'semester') {
      const currentFormData = { ...formData, [name]: value };
      
      if (currentFormData.year && currentFormData.branch && currentFormData.semester) {
        const existingId = isEditMode && existingTimetable ? existingTimetable.id : undefined;
        const duplicateExists = doesTimetableExist(currentFormData, existingId);
        
        if (duplicateExists) {
          toast({
            title: "Duplicate Timetable",
            description: `A timetable for ${currentFormData.year} Year ${currentFormData.branch} ${currentFormData.semester} already exists.`,
            variant: "destructive",
          });
          
          setErrors(prev => ({
            ...prev,
            duplicateTimetable: `A timetable for ${currentFormData.year} Year ${currentFormData.branch} ${currentFormData.semester} already exists.`
          }));
        } else if (errors.duplicateTimetable) {
          setErrors(prev => {
            const newErrors = { ...prev };
            delete newErrors.duplicateTimetable;
            return newErrors;
          });
        }
      }
    }
  };

  const handleAddSubjectTeacherPair = () => {
    if (!newSubject.trim() || !newTeacher.trim()) {
      toast({
        title: "Missing information",
        description: "Please enter both subject and teacher name",
        variant: "destructive",
      });
      return;
    }
    
    if (!isLabSubject && countNonLabSubjectsForTeacher(newTeacher, formData.subjectTeacherPairs) >= 3) {
      toast({
        title: "Teacher limit reached",
        description: "This teacher is already allotted for 3 non-lab subjects in this timetable",
        variant: "destructive",
      });
      return;
    }
    
    if (isLabSubject && !batchNumber.trim()) {
      toast({
        title: "Missing batch number",
        description: "Please specify a batch number for lab subjects",
        variant: "destructive",
      });
      return;
    }
    
    if (isLabSubject && multipleTeachers && !newTeacher2.trim()) {
      toast({
        title: "Missing second teacher",
        description: "Please select a second teacher for the lab",
        variant: "destructive",
      });
      return;
    }
    
    if (!isLabSubject && subjectTeacherPairExists(newSubject, newTeacher, formData.subjectTeacherPairs)) {
      toast({
        title: "Duplicate pair",
        description: "This subject-teacher pair already exists",
        variant: "destructive",
      });
      return;
    }
    
    if (!isLabSubject) {
      const teachersToCheck = multipleTeachers ? [newTeacher, newTeacher2] : [newTeacher];
      const overloadedFaculty = [];
      
      for (const teacher of teachersToCheck) {
        const { isAvailable, currentCount } = isFacultyAvailableForSubjects(teacher);
        if (!isAvailable) {
          overloadedFaculty.push({ name: teacher, count: currentCount });
        }
      }
      
      if (overloadedFaculty.length > 0) {
        const facultyNames = overloadedFaculty.map(f => f.name).join(', ');
        toast({
          title: "Faculty workload limit reached",
          description: `${facultyNames} has already been assigned the maximum of 3 non-lab subjects across all timetables.`,
          variant: "destructive",
        });
        return;
      }
    }
    
    let finalSubjectName = newSubject;
    if (isLabSubject && !finalSubjectName.toLowerCase().includes('lab')) {
      finalSubjectName = `${finalSubjectName} lab`;
    }
    
    const teacherNames = multipleTeachers ? [newTeacher, newTeacher2] : [newTeacher];
    
    const newPair: SubjectTeacherPair = {
      id: uuidv4(),
      subjectName: finalSubjectName,
      teacherName: newTeacher,
      teacherNames: teacherNames,
      isLab: isLabSubject,
      batchNumber: isLabSubject ? batchNumber : undefined
    };
    
    setFormData(prev => ({
      ...prev,
      subjectTeacherPairs: [...prev.subjectTeacherPairs, newPair]
    }));
    
    if (!isLabSubject) {
      const updatedWorkload = {...facultyWorkload};
      teacherNames.forEach(teacher => {
        if (updatedWorkload[teacher]) {
          updatedWorkload[teacher].currentCount += 1;
          updatedWorkload[teacher].remainingCapacity = Math.max(0, 3 - updatedWorkload[teacher].currentCount);
          updatedWorkload[teacher].isAvailable = updatedWorkload[teacher].remainingCapacity > 0;
        }
      });
      setFacultyWorkload(updatedWorkload);
    }
    
    setNewSubject('');
    setNewTeacher('');
    setNewTeacher2('');
    setIsLabSubject(false);
    setMultipleTeachers(false);
    setBatchNumber('');
  };

  const handleRemoveSubjectTeacherPair = (id: string) => {
    setFormData(prev => ({
      ...prev,
      subjectTeacherPairs: prev.subjectTeacherPairs.filter(pair => pair.id !== id)
    }));
  };

  const handleAddFreeHour = () => {
    if (newFreeHourType === 'Others' && !customFreeHourType.trim()) {
      toast({
        title: "Missing information",
        description: "Please specify the custom free hour type",
        variant: "destructive",
      });
      return;
    }
    
    const newFreeHour = {
      type: newFreeHourType,
      customType: newFreeHourType === 'Others' ? customFreeHourType : undefined,
      mergeSlots: mergeFreeSlots
    };
    
    setFormData(prev => ({
      ...prev,
      freeHours: [...prev.freeHours, newFreeHour]
    }));
    
    setNewFreeHourType('Library');
    setCustomFreeHourType('');
    setMergeFreeSlots(false);
  };

  const handleRemoveFreeHour = (index: number) => {
    setFormData(prev => ({
      ...prev,
      freeHours: prev.freeHours.filter((_, i) => i !== index)
    }));
  };

  const handleDayOptionChange = (option: 'fourContinuousDays' | 'useCustomDays', value: boolean) => {
    setFormData(prev => ({
      ...prev,
      dayOptions: {
        ...prev.dayOptions,
        [option]: value,
        ...(option === 'fourContinuousDays' && value ? { useCustomDays: false } : {}),
        ...(option === 'useCustomDays' && value ? { fourContinuousDays: false } : {})
      }
    }));
  };

  const toggleCustomDay = (day: Day) => {
    setFormData(prev => {
      const isSelected = prev.dayOptions.selectedDays.includes(day);
      return {
        ...prev,
        dayOptions: {
          ...prev.dayOptions,
          selectedDays: isSelected
            ? prev.dayOptions.selectedDays.filter(d => d !== day)
            : [...prev.dayOptions.selectedDays, day]
        }
      };
    });
  };

  const validateCurrentStep = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (currentStep === 0) {
      if (!formData.year) newErrors.year = "Year is required";
      if (!formData.semester) newErrors.semester = "Semester is required";
      if (!formData.branch) newErrors.branch = "Branch is required";
      if (formData.branch === 'Other' && !formData.customBranch) {
        newErrors.customBranch = "Custom branch name is required";
      }
      if (!formData.courseName) newErrors.courseName = "Course name is required";
      if (!formData.roomNumber) newErrors.roomNumber = "Room number is required";
      if (!formData.academicYear) newErrors.academicYear = "Academic year is required";
      if (!formData.classInchargeName) newErrors.classInchargeName = "Class incharge name is required";
      if (!formData.mobileNumber) newErrors.mobileNumber = "Mobile number is required";
      if (formData.mobileNumber && formData.mobileNumber.length < 10) {
        newErrors.mobileNumber = "Mobile number must be at least 10 digits";
      }
      if (!formData.date) newErrors.date = "Date is required";
      
      const existingId = isEditMode && existingTimetable ? existingTimetable.id : undefined;
      if (doesTimetableExist(formData, existingId)) {
        newErrors.duplicateTimetable = `A timetable for ${formData.year} Year ${formData.branch} ${formData.semester} already exists.`;
      }
    }
    else if (currentStep === 1) {
      if (formData.subjectTeacherPairs.length === 0) {
        newErrors.subjectTeacherPairs = "At least one subject-teacher pair is required";
      }
    }
    else if (currentStep === 2) {
      if (formData.freeHours.length === 0) {
        newErrors.freeHours = "At least one free hour type is required";
      }
      
      if (formData.year === '4th Year' && formData.dayOptions.useCustomDays && formData.dayOptions.selectedDays.length === 0) {
        newErrors.selectedDays = "Please select at least one day";
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNextStep = () => {
    if (validateCurrentStep()) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrevStep = () => {
    setCurrentStep(prev => prev - 1);
  };

  const handleGenerateTimetable = () => {
    if (!validateCurrentStep()) {
      return;
    }
    
    try {
      let newTimetable;
      
      if (schedulingMode === 'auto') {
        newTimetable = generateTimetable(formData);
      } else {
        if (manualTimetableEntries.length === 0) {
          toast({
            title: "Manual scheduling incomplete",
            description: "Please complete the manual scheduling before generating the timetable",
            variant: "destructive",
          });
          return;
        }
        
        newTimetable = {
          id: uuidv4(),
          formData: formData,
          entries: manualTimetableEntries,
          createdAt: new Date().toISOString(),
          facultyDetails: {} // Adding missing property
        };
      }
      
      if (isEditMode && existingTimetable) {
        newTimetable.id = existingTimetable.id;
        newTimetable.createdAt = existingTimetable.createdAt;
        newTimetable.facultyDetails = existingTimetable.facultyDetails || {};
      }
      
      const saveResult = saveTimetable(newTimetable);
      
      if (!saveResult.success) {
        toast({
          title: "Error",
          description: saveResult.message || "An error occurred while saving the timetable.",
          variant: "destructive",
        });
        return;
      }
      
      toast({
        title: isEditMode ? "Timetable updated" : "Timetable created",
        description: isEditMode 
          ? "The timetable has been successfully updated" 
          : "The timetable has been successfully generated",
      });
      
      navigate(`/view-timetable/${newTimetable.id}`);
    } catch (error) {
      console.error("Error generating timetable:", error);
      toast({
        title: "Error",
        description: "An error occurred while generating the timetable. Please try again.",
        variant: "destructive",
      });
    }
  };

  const renderFacultyDropdown = (value: string, onChange: (value: string) => void, label: string, id: string) => {
    return (
      <div className="space-y-2">
        <Label htmlFor={id}>{label}</Label>
        <Select
          value={value}
          onValueChange={onChange}
        >
          <SelectTrigger id={id}>
            <SelectValue placeholder={multipleTeachers ? "Select First Teacher" : "Select Teacher"} />
          </SelectTrigger>
          <SelectContent>
            {availableFaculty.length === 0 ? (
              <SelectItem value="no-faculty-available" disabled>
                No faculty available - create faculty first
              </SelectItem>
            ) : (
              availableFaculty.map(faculty => {
                const workload = facultyWorkload[faculty.name];
                const isAvailable = workload?.isAvailable ?? true;
                const remainingCapacity = workload?.remainingCapacity ?? 3;
                
                return (
                  <SelectItem 
                    key={faculty.id} 
                    value={faculty.name}
                    disabled={!isAvailable && !isLabSubject} // Only disable for non-lab subjects
                  >
                    <div className="flex items-center justify-between w-full">
                      <span>{faculty.name} ({faculty.shortName})</span>
                      <span className={`text-xs ${isAvailable ? 'text-green-600' : 'text-red-600'}`}>
                        {isAvailable 
                          ? `${remainingCapacity} subject${remainingCapacity !== 1 ? 's' : ''} left` 
                          : 'Fully assigned'}
                      </span>
                    </div>
                  </SelectItem>
                );
              })
            )}
          </SelectContent>
        </Select>
        {availableFaculty.length === 0 && (
          <p className="text-xs text-destructive">
            Please add faculty in Manage Faculty page first
          </p>
        )}
      </div>
    );
  };

  const handleFreeHourTypeChange = (value: string) => {
    setNewFreeHourType(value as FreeHourType);
  };

  const handleManualEntriesChange = (entries: TimetableEntry[]) => {
    setManualTimetableEntries(entries);
  };

  return (
    <div className="space-y-6">
      {!isEditMode && (
        <div>
          <p className="text-muted-foreground">
          </p>
        </div>
      )}
      
      <div className="space-y-8">
        <Tabs value={currentStep.toString()} onValueChange={(value) => setCurrentStep(parseInt(value))}>
          <TabsList className="grid grid-cols-3 w-full max-w-md">
            <TabsTrigger value="0" disabled={currentStep < 0}>
              Academic Details
            </TabsTrigger>
            <TabsTrigger value="1" disabled={currentStep < 1}>
              Subjects & Teachers
            </TabsTrigger>
            <TabsTrigger value="2" disabled={currentStep < 2}>
              Scheduling
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="0" className="pt-4">
            <Card>
              <CardHeader>
                <CardTitle>Academic Details</CardTitle>
                <CardDescription>
                  Enter the basic information for this timetable
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {errors.duplicateTimetable && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Duplicate Timetable</AlertTitle>
                    <AlertDescription>
                      {errors.duplicateTimetable}
                    </AlertDescription>
                  </Alert>
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="year">Year</Label>
                    <Select 
                      value={formData.year} 
                      onValueChange={(value) => handleSelectChange('year', value)}
                    >
                      <SelectTrigger id="year" className={errors.year ? 'border-destructive' : ''}>
                        <SelectValue placeholder="Select Year" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1st Year">1st Year</SelectItem>
                        <SelectItem value="2nd Year">2nd Year</SelectItem>
                        <SelectItem value="3rd Year">3rd Year</SelectItem>
                        <SelectItem value="4th Year">4th Year</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.year && <p className="text-sm text-destructive">{errors.year}</p>}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="semester">Semester</Label>
                    <Select 
                      value={formData.semester} 
                      onValueChange={(value) => handleSelectChange('semester', value)}
                    >
                      <SelectTrigger id="semester" className={errors.semester ? 'border-destructive' : ''}>
                        <SelectValue placeholder="Select Semester" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="I">I</SelectItem>
                        <SelectItem value="II">II</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.semester && <p className="text-sm text-destructive">{errors.semester}</p>}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="branch">Branch</Label>
                    <Select 
                      value={formData.branch} 
                      onValueChange={(value) => handleSelectChange('branch', value)}
                    >
                      <SelectTrigger id="branch" className={errors.branch ? 'border-destructive' : ''}>
                        <SelectValue placeholder="Select Branch" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CSE">CSE</SelectItem>
                        <SelectItem value="IT">IT</SelectItem>
                        <SelectItem value="ECE">ECE</SelectItem>
                        <SelectItem value="EEE">EEE</SelectItem>
                        <SelectItem value="CSD">CSD</SelectItem>
                        <SelectItem value="AI & ML">AI & ML</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.branch && <p className="text-sm text-destructive">{errors.branch}</p>}
                  </div>
                  
                  {formData.branch === 'Other' && (
                    <div className="space-y-2">
                      <Label htmlFor="customBranch">Custom Branch Name</Label>
                      <Input
                        id="customBranch"
                        name="customBranch"
                        placeholder="Enter branch name"
                        value={formData.customBranch}
                        onChange={handleInputChange}
                        className={errors.customBranch ? 'border-destructive' : ''}
                      />
                      {errors.customBranch && <p className="text-sm text-destructive">{errors.customBranch}</p>}
                    </div>
                  )}
                  
                  <div className="space-y-2">
                    <Label htmlFor="courseName">Course Name</Label>
                    <Input
                      id="courseName"
                      name="courseName"
                      placeholder="e.g., B.Tech"
                      value={formData.courseName}
                      onChange={handleInputChange}
                      className={errors.courseName ? 'border-destructive' : ''}
                    />
                    {errors.courseName && <p className="text-sm text-destructive">{errors.courseName}</p>}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="roomNumber">Room Number</Label>
                    <Input
                      id="roomNumber"
                      name="roomNumber"
                      placeholder="e.g., 301"
                      value={formData.roomNumber}
                      onChange={handleInputChange}
                      className={errors.roomNumber ? 'border-destructive' : ''}
                    />
                    {errors.roomNumber && <p className="text-sm text-destructive">{errors.roomNumber}</p>}
                  </div>
                </div>
                
                <Separator />
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="academicYear">Academic Year</Label>
                    <Input
                      id="academicYear"
                      name="academicYear"
                      placeholder="e.g., 2023-2024"
                      value={formData.academicYear}
                      onChange={handleInputChange}
                      className={errors.academicYear ? 'border-destructive' : ''}
                    />
                    {errors.academicYear && <p className="text-sm text-destructive">{errors.academicYear}</p>}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="classInchargeName">Class Incharge Name</Label>
                    <Input
                      id="classInchargeName"
                      name="classInchargeName"
                      placeholder="e.g., Dr. Vanisree"
                      value={formData.classInchargeName}
                      onChange={handleInputChange}
                      className={errors.classInchargeName ? 'border-destructive' : ''}
                    />
                    {errors.classInchargeName && <p className="text-sm text-destructive">{errors.classInchargeName}</p>}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="mobileNumber">Mobile Number</Label>
                    <Input
                      id="mobileNumber"
                      name="mobileNumber"
                      placeholder="e.g., 9876543210"
                      value={formData.mobileNumber}
                      onChange={handleInputChange}
                      className={errors.mobileNumber ? 'border-destructive' : ''}
                    />
                    {errors.mobileNumber && <p className="text-sm text-destructive">{errors.mobileNumber}</p>}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="date">Date</Label>
                    <Input
                      id="date"
                      name="date"
                      type="date"
                      value={formData.date}
                      onChange={handleInputChange}
                      className={errors.date ? 'border-destructive' : ''}
                    />
                    {errors.date && <p className="text-sm text-destructive">{errors.date}</p>}
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <div className="flex justify-end mt-4">
              <Button onClick={handleNextStep}>Next Step</Button>
            </div>
          </TabsContent>
          
          <TabsContent value="1" className="pt-4">
            <Card>
              <CardHeader>
                <CardTitle>Subjects & Teachers</CardTitle>
                <CardDescription>
                  Add subjects and assign teachers for this timetable
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Important</AlertTitle>
                    <AlertDescription>
                      <ul className="list-disc pl-5 space-y-1">
                        <li>
                          For lab subjects, make sure to add "lab" at the end of the subject name (e.g., "Physics lab").
                          This is required for proper scheduling of lab sessions.
                        </li>
                        <li>
                          Each non-lab subject will receive 4 periods per week (either as individual hours or as 2-hour blocks).
                        </li>
                        <li>
                          Lab subjects will be scheduled in merged time slots: 9:30-1:00, 10:20-1:00, or 2:00-4:30.
                        </li>
                        <li>
                          Each teacher can be assigned a maximum of 3 non-lab subjects <strong>across all timetables</strong>.
                          Lab subjects do not count towards this limit.
                        </li>
                        <li>
                          To use batch rotation for labs, create lab subjects with matching names but different batch numbers (B1/B2).
                        </li>
                        <li>
                          Lab subjects can have up to 2 teachers assigned to them.
                        </li>
                      </ul>
                    </AlertDescription>
                  </Alert>
                  
                  <Alert variant="default" className="bg-blue-50 border-blue-200">
                    <InfoIcon className="h-4 w-4 text-blue-700" />
                    <AlertTitle className="text-blue-700">Faculty Workload Limit</AlertTitle>
                    <AlertDescription className="text-blue-700">
                      Each faculty can teach a maximum of 3 non-lab subjects across all timetables.
                      Lab subjects do not count towards this limit.
                      <div className="mt-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="bg-white text-blue-700 border-blue-300 hover:bg-blue-50"
                          onClick={() => navigate('/faculty-workload')}
                        >
                          View Faculty Workload
                        </Button>
                      </div>
                    </AlertDescription>
                  </Alert>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div className="space-y-2">
                      <Label htmlFor="newSubject">Subject</Label>
                      <Select
                        value={newSubject}
                        onValueChange={setNewSubject}
                      >
                        <SelectTrigger id="newSubject">
                          <SelectValue placeholder="Select Subject" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableSubjects.length === 0 ? (
                            <SelectItem value="no-subjects-available" disabled>
                              No subjects available - create subjects first
                            </SelectItem>
                          ) : (
                            availableSubjects.map(subject => (
                              <SelectItem key={subject.id} value={subject.name}>
                                {subject.name} {subject.isLab && "(Lab)"}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      {availableSubjects.length === 0 && (
                        <p className="text-xs text-destructive">
                          Please add subjects in Manage Subjects page first
                        </p>
                      )}
                    </div>
                    
                    <div className="space-y-4">
                      <div className="flex items-center space-x-2 pt-7">
                        <Checkbox 
                          id="isLabSubject" 
                          checked={isLabSubject} 
                          onCheckedChange={(checked) => {
                            setIsLabSubject(checked === true);
                            if (checked !== true) {
                              setMultipleTeachers(false);
                            }
                          }}
                        />
                        <Label htmlFor="isLabSubject">This is a lab subject</Label>
                      </div>
                      
                      {isLabSubject && (
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="batchNumber">Batch Number</Label>
                            <Select
                              value={batchNumber}
                              onValueChange={setBatchNumber}
                            >
                              <SelectTrigger id="batchNumber">
                                <SelectValue placeholder="Select Batch" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="B1">B1</SelectItem>
                                <SelectItem value="B2">B2</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          
                          <div className="space-y-2">
                            <Label>Number of Teachers</Label>
                            <RadioGroup 
                              value={multipleTeachers ? "2" : "1"} 
                              onValueChange={(value) => setMultipleTeachers(value === "2")}
                              className="flex flex-row gap-4"
                            >
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="1" id="single-teacher" />
                                <Label htmlFor="single-teacher">Single Teacher</Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="2" id="two-teachers" />
                                <Label htmlFor="two-teachers">Two Teachers</Label>
                              </div>
                            </RadioGroup>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {renderFacultyDropdown(
                      newTeacher, 
                      setNewTeacher, 
                      multipleTeachers ? "Teacher 1" : "Teacher", 
                      "newTeacher"
                    )}
                    
                    {multipleTeachers && (
                      renderFacultyDropdown(
                        newTeacher2,
                        setNewTeacher2,
                        "Teacher 2",
                        "newTeacher2"
                      )
                    )}
                  </div>
                  
                  <div className="flex justify-end">
                    <Button 
                      onClick={handleAddSubjectTeacherPair}
                      className="flex items-center gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      Add Subject-Teacher Pair
                    </Button>
                  </div>
                  
                  {formData.subjectTeacherPairs.length > 0 && (
                    <div className="mt-6">
                      <h3 className="text-lg font-medium mb-4">Added Subject-Teacher Pairs</h3>
                      <div className="space-y-2">
                        {formData.subjectTeacherPairs.map((pair) => (
                          <div 
                            key={pair.id} 
                            className="flex items-center justify-between p-3 rounded-md bg-gray-50 border"
                          >
                            <div>
                              <span className="font-medium">{pair.subjectName}</span>
                              <span className="ml-2 text-sm text-gray-500">
                                {pair.isLab ? (
                                  <>
                                    <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-xs mr-1">
                                      LAB {pair.batchNumber}
                                    </span>
                                    {pair.teacherNames && pair.teacherNames.length > 1 ? (
                                      <span className="text-sm text-gray-600">
                                        {pair.teacherNames.join(', ')}
                                      </span>
                                    ) : (
                                      <span className="text-sm text-gray-600">{pair.teacherName}</span>
                                    )}
                                  </>
                                ) : (
                                  <span className="text-sm text-gray-600">{pair.teacherName}</span>
                                )}
                              </span>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveSubjectTeacherPair(pair.id)}
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {errors.subjectTeacherPairs && (
                    <p className="text-sm text-destructive">{errors.subjectTeacherPairs}</p>
                  )}
                </div>
              </CardContent>
            </Card>
            
            <div className="flex justify-between mt-4">
              <Button variant="outline" onClick={handlePrevStep}>Previous Step</Button>
              <Button onClick={handleNextStep}>Next Step</Button>
            </div>
          </TabsContent>
          
          <TabsContent value="2" className="pt-4">
            <Card>
              <CardHeader>
                <CardTitle>Scheduling Options</CardTitle>
                <CardDescription>
                  Choose how you want to create this timetable
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <RadioGroup 
                    value={schedulingMode} 
                    onValueChange={(value: 'auto' | 'manual') => setSchedulingMode(value)}
                    className="grid grid-cols-1 md:grid-cols-2 gap-4"
                  >
                    <div className="flex items-start space-x-3 p-4 border rounded-md">
                      <RadioGroupItem value="auto" id="auto-scheduling" className="mt-1" />
                      <div>
                        <Label htmlFor="auto-scheduling" className="text-base font-medium">
                          Automatic Scheduling
                        </Label>
                        <p className="text-sm text-muted-foreground mt-1">
                          Let the system automatically generate a balanced timetable
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-start space-x-3 p-4 border rounded-md">
                      <RadioGroupItem value="manual" id="manual-scheduling" className="mt-1" />
                      <div>
                        <Label htmlFor="manual-scheduling" className="text-base font-medium">
                          Manual Scheduling
                        </Label>
                        <p className="text-sm text-muted-foreground mt-1">
                          Customize each time slot manually for complete control
                        </p>
                      </div>
                    </div>
                  </RadioGroup>
                  
                  {schedulingMode === 'auto' && (
                    <div className="space-y-6">
                      <Card className="border-dashed">
                        <CardHeader className="p-4">
                          <CardTitle className="text-base">Free Hours</CardTitle>
                          <CardDescription>
                            Add free hours to include in the timetable
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="p-4 pt-0">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                            <div className="space-y-2">
                              <Label htmlFor="newFreeHourType">Free Hour Type</Label>
                              <Select
                                value={newFreeHourType}
                                onValueChange={handleFreeHourTypeChange}
                              >
                                <SelectTrigger id="newFreeHourType">
                                  <SelectValue placeholder="Select Type" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Library">Library</SelectItem>
                                  <SelectItem value="Sports">Sports</SelectItem>
                                  <SelectItem value="Project">Project</SelectItem>
                                  <SelectItem value="Others">Others</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            
                            {newFreeHourType === 'Others' && (
                              <div className="space-y-2">
                                <Label htmlFor="customFreeHourType">Custom Type</Label>
                                <Input
                                  id="customFreeHourType"
                                  value={customFreeHourType}
                                  onChange={(e) => setCustomFreeHourType(e.target.value)}
                                  placeholder="e.g., Skill Development"
                                />
                              </div>
                            )}
                            
                            <div className="flex items-center space-x-2 pt-7">
                              <Checkbox 
                                id="mergeFreeSlots" 
                                checked={mergeFreeSlots} 
                                onCheckedChange={(checked) => setMergeFreeSlots(checked === true)}
                              />
                              <Label htmlFor="mergeFreeSlots">Merge consecutive slots</Label>
                            </div>
                          </div>
                          
                          <div className="flex justify-end">
                            <Button 
                              onClick={handleAddFreeHour}
                              className="flex items-center gap-2"
                            >
                              <Plus className="h-4 w-4" />
                              Add Free Hour
                            </Button>
                          </div>
                          
                          {formData.freeHours.length > 0 && (
                            <div className="mt-4">
                              <h3 className="text-sm font-medium mb-2">Added Free Hours</h3>
                              <div className="space-y-2">
                                {formData.freeHours.map((freeHour, index) => (
                                  <div 
                                    key={index} 
                                    className="flex items-center justify-between p-2 rounded-md bg-gray-50 border"
                                  >
                                    <div>
                                      <span>{freeHour.type === 'Others' ? freeHour.customType : freeHour.type}</span>
                                      {freeHour.mergeSlots && (
                                        <span className="ml-2 px-2 py-0.5 rounded-full bg-green-100 text-green-800 text-xs">
                                          Merged
                                        </span>
                                      )}
                                    </div>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleRemoveFreeHour(index)}
                                      className="text-destructive"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {errors.freeHours && (
                            <p className="text-sm text-destructive mt-2">{errors.freeHours}</p>
                          )}
                        </CardContent>
                      </Card>
                      
                      {formData.year === '4th Year' && (
                        <Card className="border-dashed">
                          <CardHeader className="p-4">
                            <CardTitle className="text-base">Day Options for 4th Year</CardTitle>
                            <CardDescription>
                              Configure which days to include in the timetable
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="p-4 pt-0">
                            <div className="space-y-4">
                              <div className="flex items-center space-x-2">
                                <Checkbox 
                                  id="fourContinuousDays" 
                                  checked={formData.dayOptions.fourContinuousDays} 
                                  onCheckedChange={(checked) => 
                                    handleDayOptionChange('fourContinuousDays', checked === true)
                                  }
                                  disabled={formData.dayOptions.useCustomDays}
                                />
                                <Label htmlFor="fourContinuousDays">
                                  Use 4 continuous days (Mon-Thu)
                                </Label>
                              </div>
                              
                              <div className="flex items-center space-x-2">
                                <Checkbox 
                                  id="useCustomDays" 
                                  checked={formData.dayOptions.useCustomDays} 
                                  onCheckedChange={(checked) => 
                                    handleDayOptionChange('useCustomDays', checked === true)
                                  }
                                  disabled={formData.dayOptions.fourContinuousDays}
                                />
                                <Label htmlFor="useCustomDays">
                                  Use custom day selection
                                </Label>
                              </div>
                              
                              {formData.dayOptions.useCustomDays && (
                                <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mt-2">
                                  {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day) => (
                                    <div 
                                      key={day} 
                                      className={`flex items-center justify-center p-2 rounded border cursor-pointer transition-colors ${
                                        formData.dayOptions.selectedDays.includes(day as Day)
                                          ? 'bg-primary text-primary-foreground'
                                          : 'bg-background hover:bg-muted'
                                      }`}
                                      onClick={() => toggleCustomDay(day as Day)}
                                    >
                                      {day.substring(0, 3)}
                                    </div>
                                  ))}
                                </div>
                              )}
                              
                              {errors.selectedDays && (
                                <p className="text-sm text-destructive">{errors.selectedDays}</p>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  )}
                  
                  {schedulingMode === 'manual' && (
                    <div className="space-y-4">
                      <Card className="border-dashed">
                        <CardHeader className="p-4">
                          <CardTitle className="text-base">Manual Scheduling Grid</CardTitle>
                          <CardDescription>
                            Drag and drop subjects to create your timetable
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="p-4 pt-0">
                          <ManualSchedulingGrid
                            subjectTeacherPairs={formData.subjectTeacherPairs}
                            year={formData.year}
                            initialEntries={manualTimetableEntries}
                            onEntriesChange={handleManualEntriesChange}
                            freeHours={formData.freeHours}
                            dayOptions={formData.dayOptions}
                            branch={formData.branch}
                          />
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
            
            <div className="flex justify-between mt-4">
              <Button variant="outline" onClick={handlePrevStep}>Previous Step</Button>
              <Button onClick={handleGenerateTimetable}>
                {isEditMode ? "Update Timetable" : "Generate Timetable"}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default CreateTimetableForm;
