import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import ParticlesBackground from '@/components/ParticlesBackground';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { 
  GraduationCap, LogOut, Upload, FileText, Plus, Clock, 
  CheckCircle, XCircle, Loader2, File, AlertCircle, Settings, Archive
} from 'lucide-react';
import { toast } from 'sonner';
import { getYearSuffix } from '@/lib/regNoValidation';
import DashboardStats from '@/components/DashboardStats';

interface Project {
  id: string;
  title: string;
  description: string | null;
  status: 'pending' | 'approved' | 'rejected';
  feedback: string | null;
  created_at: string;
  updated_at: string;
}

interface ProjectDocument {
  id: string;
  document_type: string;
  file_name: string;
  file_path: string;
  uploaded_at: string;
}

const StudentDashboard = () => {
  const navigate = useNavigate();
  const { profile, signOut, loading: authLoading } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [isNewProjectOpen, setIsNewProjectOpen] = useState(false);
  const [newProject, setNewProject] = useState({ title: '', description: '' });
  const [uploading, setUploading] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [projectDocs, setProjectDocs] = useState<ProjectDocument[]>([]);
  const [uploadingDoc, setUploadingDoc] = useState(false);

  useEffect(() => {
    if (!authLoading && !profile) {
      navigate('/login');
    } else if (profile?.role === 'lecturer') {
      navigate('/lecturer');
    } else if (profile) {
      fetchProjects();
    }
  }, [profile, authLoading, navigate]);

  const fetchProjects = async () => {
    if (!profile) return;
    
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('student_id', profile.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProjects(data || []);
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

  const handleCreateProject = async () => {
    if (!profile?.can_submit) {
      toast.error('You are not eligible to submit projects');
      return;
    }

    if (!newProject.title.trim()) {
      toast.error('Please enter a project title');
      return;
    }

    setUploading(true);
    try {
      const { data, error } = await supabase
        .from('projects')
        .insert({
          student_id: profile.id,
          title: newProject.title,
          description: newProject.description || null,
        })
        .select()
        .single();

      if (error) throw error;

      setProjects([data, ...projects]);
      setNewProject({ title: '', description: '' });
      setIsNewProjectOpen(false);
      toast.success('Project created! Now upload your documents.');
      setSelectedProject(data);
    } catch (error: any) {
      toast.error(error.message || 'Failed to create project');
    } finally {
      setUploading(false);
    }
  };

  const handleFileUpload = async (projectId: string, docType: string, file: File) => {
    if (!profile) return;

    setUploadingDoc(true);
    try {
      const filePath = `${profile.user_id}/${projectId}/${docType}-${Date.now()}-${file.name}`;
      
      const { error: uploadError } = await supabase.storage
        .from('project-documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase
        .from('project_documents')
        .insert({
          project_id: projectId,
          document_type: docType,
          file_name: file.name,
          file_path: filePath,
          file_size: file.size,
        });

      if (dbError) throw dbError;

      toast.success(`${docType} uploaded successfully`);
      fetchProjectDocuments(projectId);
    } catch (error: any) {
      toast.error(error.message || 'Failed to upload file');
    } finally {
      setUploadingDoc(false);
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
              <p className="text-xs text-muted-foreground">Student Dashboard</p>
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
              <Link to="/settings">
                <Settings className="w-4 h-4 mr-1" />
                Settings
              </Link>
            </Button>
            <div className="text-right hidden sm:block ml-2">
              <p className="text-sm font-medium">{profile?.full_name}</p>
              <p className="text-xs text-muted-foreground">
                {profile?.year_of_study && getYearSuffix(profile.year_of_study)} Year • {profile?.course_name}
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={handleLogout}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 container mx-auto px-4 py-8">
        {/* Can Submit Notice */}
        {!profile?.can_submit && (
          <Card variant="glass" className="mb-6 border-warning/30">
            <CardContent className="flex items-center gap-3 py-4">
              <AlertCircle className="w-5 h-5 text-warning" />
              <div>
                <p className="font-medium text-warning">Limited Access</p>
                <p className="text-sm text-muted-foreground">
                  Only 3rd and 5th year students can submit projects. You can view existing submissions.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats */}
        {projects.length > 0 && (
          <DashboardStats 
            pending={stats.pending}
            approved={stats.approved}
            rejected={stats.rejected}
            total={stats.total}
          />
        )}

        {/* Header with Create Button */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-display font-bold">My Projects</h2>
            <p className="text-muted-foreground">Manage your academic project submissions</p>
          </div>
          
          {profile?.can_submit && (
            <Dialog open={isNewProjectOpen} onOpenChange={setIsNewProjectOpen}>
              <DialogTrigger asChild>
                <Button variant="gradient">
                  <Plus className="w-4 h-4" />
                  New Project
                </Button>
              </DialogTrigger>
              <DialogContent className="glass-card border-border">
                <DialogHeader>
                  <DialogTitle className="font-display">Create New Project</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Project Title</Label>
                    <Input
                      placeholder="Enter project title"
                      value={newProject.title}
                      onChange={(e) => setNewProject({ ...newProject, title: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Description (Optional)</Label>
                    <Textarea
                      placeholder="Brief description of your project"
                      value={newProject.description}
                      onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                      className="min-h-[100px] bg-input border-border"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsNewProjectOpen(false)}>Cancel</Button>
                  <Button variant="gradient" onClick={handleCreateProject} disabled={uploading}>
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Project'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Projects Grid */}
        {projects.length === 0 ? (
          <Card variant="glass" className="text-center py-16">
            <CardContent>
              <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No Projects Yet</h3>
              <p className="text-muted-foreground mb-4">
                {profile?.can_submit 
                  ? 'Start by creating your first project submission.'
                  : 'You currently have no project submissions.'}
              </p>
              {profile?.can_submit && (
                <Button variant="gradient" onClick={() => setIsNewProjectOpen(true)}>
                  <Plus className="w-4 h-4" />
                  Create First Project
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <Card 
                key={project.id} 
                variant="glass" 
                className="glass-card-hover cursor-pointer"
                onClick={() => {
                  setSelectedProject(project);
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
                  <p className="text-xs text-muted-foreground">
                    Submitted {new Date(project.created_at).toLocaleDateString()}
                  </p>
                  {project.feedback && project.status !== 'pending' && (
                    <div className="mt-3 p-3 rounded-lg bg-muted/50">
                      <p className="text-xs font-medium mb-1">Feedback:</p>
                      <p className="text-sm text-muted-foreground">{project.feedback}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Project Details Dialog */}
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

                {/* Feedback Section */}
                {selectedProject.feedback && selectedProject.status !== 'pending' && (
                  <div className={`p-4 rounded-lg ${
                    selectedProject.status === 'approved' 
                      ? 'bg-success/10 border border-success/20' 
                      : 'bg-destructive/10 border border-destructive/20'
                  }`}>
                    <p className="text-sm font-medium mb-1">Reviewer Feedback:</p>
                    <p className="text-sm">{selectedProject.feedback}</p>
                  </div>
                )}

                {/* Documents Section */}
                <div className="space-y-4 mt-4">
                  <h3 className="font-medium">Project Documents</h3>
                  
                  {selectedProject.status === 'pending' && (
                    <div className="grid grid-cols-2 gap-3">
                      {['PRD', 'SDD', 'Final Report', 'Supporting Files'].map((docType) => (
                        <div key={docType} className="relative">
                          <input
                            type="file"
                            id={`upload-${docType}`}
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleFileUpload(selectedProject.id, docType, file);
                            }}
                            accept=".pdf,.doc,.docx,.ppt,.pptx,.zip"
                          />
                          <label
                            htmlFor={`upload-${docType}`}
                            className="flex items-center gap-2 p-3 rounded-lg border border-dashed border-border hover:border-primary/50 cursor-pointer transition-colors text-sm"
                          >
                            <Upload className="w-4 h-4 text-muted-foreground" />
                            Upload {docType}
                          </label>
                        </div>
                      ))}
                    </div>
                  )}

                  {uploadingDoc && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Uploading...
                    </div>
                  )}

                  {/* Uploaded Documents List */}
                  {projectDocs.length > 0 && (
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
                        </div>
                      ))}
                    </div>
                  )}

                  {projectDocs.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No documents uploaded yet
                    </p>
                  )}
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default StudentDashboard;
