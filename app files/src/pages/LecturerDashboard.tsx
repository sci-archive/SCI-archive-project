import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import ParticlesBackground from '@/components/ParticlesBackground';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  GraduationCap, LogOut, FileText, Clock, CheckCircle, XCircle, 
  Loader2, File, Download, Users, FolderOpen, Settings, Archive
} from 'lucide-react';
import { toast } from 'sonner';
import { getYearSuffix } from '@/lib/regNoValidation';
import DashboardStats from '@/components/DashboardStats';

interface ProjectWithStudent {
  id: string;
  title: string;
  description: string | null;
  status: 'pending' | 'approved' | 'rejected';
  feedback: string | null;
  created_at: string;
  updated_at: string;
  student: {
    id: string;
    full_name: string;
    registration_number: string;
    course_name: string;
    year_of_study: number;
  };
}

interface ProjectDocument {
  id: string;
  document_type: string;
  file_name: string;
  file_path: string;
  uploaded_at: string;
}

const LecturerDashboard = () => {
  const navigate = useNavigate();
  const { profile, signOut, loading: authLoading } = useAuth();
  const [projects, setProjects] = useState<ProjectWithStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<ProjectWithStudent | null>(null);
  const [projectDocs, setProjectDocs] = useState<ProjectDocument[]>([]);
  const [feedback, setFeedback] = useState('');
  const [reviewing, setReviewing] = useState(false);
  const [activeTab, setActiveTab] = useState('pending');

  useEffect(() => {
    if (!authLoading && !profile) {
      navigate('/login');
    } else if (profile?.role === 'student') {
      navigate('/student');
    } else if (profile) {
      fetchProjects();
    }
  }, [profile, authLoading, navigate]);

  const fetchProjects = async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
          student:profiles!projects_student_id_fkey(
            id,
            full_name,
            registration_number,
            course_name,
            year_of_study
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProjects((data as unknown as ProjectWithStudent[]) || []);
    } catch (error) {
      console.error('Error fetching projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProjectDocuments = async (projectId: string) => {
    try {
      const { data, error } = await supabase
        .from('project_documents')
        .select('*')
        .eq('project_id', projectId)
        .order('uploaded_at', { ascending: false });

      if (error) throw error;
      setProjectDocs(data || []);
    } catch (error) {
      console.error('Error fetching documents:', error);
    }
  };

  const handleDownloadDocument = async (doc: ProjectDocument) => {
    try {
      const { data, error } = await supabase.storage
        .from('project-documents')
        .download(doc.file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.file_name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error: any) {
      toast.error('Failed to download file');
    }
  };

  const handleReview = async (status: 'approved' | 'rejected') => {
    if (!selectedProject || !profile) return;

    if (!feedback.trim() && status === 'rejected') {
      toast.error('Please provide feedback when rejecting a project');
      return;
    }

    setReviewing(true);
    try {
      const { error } = await supabase
        .from('projects')
        .update({
          status,
          feedback: feedback.trim() || null,
          reviewed_by: profile.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', selectedProject.id);

      if (error) throw error;

      toast.success(`Project ${status}`);
      setSelectedProject(null);
      setFeedback('');
      fetchProjects();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update project');
    } finally {
      setReviewing(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="w-4 h-4" />;
      case 'rejected':
        return <XCircle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const filteredProjects = projects.filter(p => {
    if (activeTab === 'pending') return p.status === 'pending';
    if (activeTab === 'reviewed') return p.status !== 'pending';
    return true;
  });

  const stats = {
    pending: projects.filter(p => p.status === 'pending').length,
    approved: projects.filter(p => p.status === 'approved').length,
    rejected: projects.filter(p => p.status === 'rejected').length,
    total: projects.length,
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <ParticlesBackground />
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen relative">
      <ParticlesBackground />
      
      {/* Header */}
      <header className="relative z-10 border-b border-border bg-card/50 backdrop-blur-lg">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-display font-bold text-lg gradient-text">SCI Archive</h1>
              <p className="text-xs text-muted-foreground">Lecturer Dashboard</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/archive">
                <Archive className="w-4 h-4 mr-1" />
                Archive
              </Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/users">
                <Users className="w-4 h-4 mr-1" />
                Users
              </Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/settings">
                <Settings className="w-4 h-4 mr-1" />
                Settings
              </Link>
            </Button>
            <div className="text-right hidden sm:block ml-2">
              <p className="text-sm font-medium">{profile?.full_name}</p>
              <p className="text-xs text-muted-foreground">Lecturer</p>
            </div>
            <Button variant="ghost" size="icon" onClick={handleLogout}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 container mx-auto px-4 py-8">
        {/* Stats Cards */}
        <DashboardStats 
          pending={stats.pending}
          approved={stats.approved}
          rejected={stats.rejected}
          total={stats.total}
        />

        {/* Projects Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="glass-card mb-6">
            <TabsTrigger value="pending" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Pending Review ({stats.pending})
            </TabsTrigger>
            <TabsTrigger value="reviewed" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Reviewed ({stats.approved + stats.rejected})
            </TabsTrigger>
            <TabsTrigger value="all" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              All Projects
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab}>
            {filteredProjects.length === 0 ? (
              <Card variant="glass" className="text-center py-16">
                <CardContent>
                  <FolderOpen className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Projects Found</h3>
                  <p className="text-muted-foreground">
                    {activeTab === 'pending' 
                      ? 'No pending projects to review.'
                      : 'No projects in this category.'}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredProjects.map((project) => (
                  <Card 
                    key={project.id} 
                    variant="glass" 
                    className="glass-card-hover cursor-pointer"
                    onClick={() => {
                      setSelectedProject(project);
                      setFeedback(project.feedback || '');
                      fetchProjectDocuments(project.id);
                    }}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-lg line-clamp-2">{project.title}</CardTitle>
                        <Badge variant={project.status as 'pending' | 'approved' | 'rejected'}>
                          {getStatusIcon(project.status)}
                          <span className="ml-1 capitalize">{project.status}</span>
                        </Badge>
                      </div>
                      {project.description && (
                        <CardDescription className="line-clamp-2">{project.description}</CardDescription>
                      )}
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2 text-sm">
                        <Users className="w-4 h-4 text-muted-foreground" />
                        <span>{project.student.full_name}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {project.student.registration_number} • {getYearSuffix(project.student.year_of_study)} Year
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {project.student.course_name}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Project Review Dialog */}
        <Dialog open={!!selectedProject} onOpenChange={(open) => !open && setSelectedProject(null)}>
          <DialogContent className="glass-card border-border max-w-2xl max-h-[90vh] overflow-y-auto">
            {selectedProject && (
              <>
                <DialogHeader>
                  <div className="flex items-start justify-between">
                    <DialogTitle className="font-display pr-4">{selectedProject.title}</DialogTitle>
                    <Badge variant={selectedProject.status as 'pending' | 'approved' | 'rejected'}>
                      {getStatusIcon(selectedProject.status)}
                      <span className="ml-1 capitalize">{selectedProject.status}</span>
                    </Badge>
                  </div>
                  {selectedProject.description && (
                    <p className="text-sm text-muted-foreground mt-2">{selectedProject.description}</p>
                  )}
                </DialogHeader>

                {/* Student Info */}
                <div className="p-4 rounded-lg bg-muted/50">
                  <h4 className="font-medium mb-2">Student Information</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Name:</span>
                      <span className="ml-2">{selectedProject.student.full_name}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Reg No:</span>
                      <span className="ml-2">{selectedProject.student.registration_number}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Year:</span>
                      <span className="ml-2">{getYearSuffix(selectedProject.student.year_of_study)} Year</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Course:</span>
                      <span className="ml-2">{selectedProject.student.course_name}</span>
                    </div>
                  </div>
                </div>

                {/* Documents */}
                <div className="space-y-3">
                  <h4 className="font-medium">Project Documents</h4>
                  {projectDocs.length > 0 ? (
                    <div className="space-y-2">
                      {projectDocs.map((doc) => (
                        <div 
                          key={doc.id}
                          className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                        >
                          <div className="flex items-center gap-3">
                            <File className="w-4 h-4 text-primary" />
                            <div>
                              <p className="text-sm font-medium">{doc.file_name}</p>
                              <p className="text-xs text-muted-foreground">{doc.document_type}</p>
                            </div>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleDownloadDocument(doc)}
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No documents uploaded
                    </p>
                  )}
                </div>

                {/* Feedback & Actions */}
                {selectedProject.status === 'pending' && (
                  <div className="space-y-4 border-t border-border pt-4">
                    <div className="space-y-2">
                      <Label>Feedback / Remarks</Label>
                      <Textarea
                        placeholder="Enter your feedback for the student..."
                        value={feedback}
                        onChange={(e) => setFeedback(e.target.value)}
                        className="min-h-[100px] bg-input border-border"
                      />
                    </div>
                    
                    <DialogFooter className="flex gap-2">
                      <Button 
                        variant="destructive"
                        onClick={() => handleReview('rejected')}
                        disabled={reviewing}
                      >
                        {reviewing ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                        Reject
                      </Button>
                      <Button 
                        variant="success"
                        onClick={() => handleReview('approved')}
                        disabled={reviewing}
                      >
                        {reviewing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                        Approve
                      </Button>
                    </DialogFooter>
                  </div>
                )}

                {/* Show existing feedback for reviewed projects */}
                {selectedProject.status !== 'pending' && selectedProject.feedback && (
                  <div className={`p-4 rounded-lg ${
                    selectedProject.status === 'approved' 
                      ? 'bg-success/10 border border-success/20' 
                      : 'bg-destructive/10 border border-destructive/20'
                  }`}>
                    <p className="text-sm font-medium mb-1">Review Feedback:</p>
                    <p className="text-sm">{selectedProject.feedback}</p>
                  </div>
                )}
              </>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default LecturerDashboard;
