import { User, Mail, Calendar, Award, BookOpen, Zap, Settings, Bell, Shield, Globe } from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";

export default function ProfilePage() {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />

      <main className="flex-1 p-4 md:p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Profile</h1>

          {/* Profile Header */}
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row items-center gap-6">
                <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center">
                  <User size={48} className="text-primary" />
                </div>
                <div className="text-center md:text-left">
                  <h2 className="text-xl font-semibold text-foreground">Guest User</h2>
                  <p className="text-muted-foreground flex items-center justify-center md:justify-start gap-2 mt-1">
                    <Mail size={16} />
                    Login to save your progress
                  </p>
                  <p className="text-sm text-muted-foreground flex items-center justify-center md:justify-start gap-2 mt-1">
                    <Calendar size={16} />
                    Joined December 2024
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <BookOpen size={16} />
                  Study Sessions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-foreground">0</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Zap size={16} />
                  Speed Runs
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-foreground">0</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Award size={16} />
                  Achievements
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-foreground">0</p>
              </CardContent>
            </Card>
          </div>

          {/* Settings Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Settings size={20} />
                Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Notifications */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Bell size={18} className="text-muted-foreground" />
                  <h3 className="font-medium text-foreground">Notifications</h3>
                </div>
                <div className="space-y-3 ml-7">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="email-notifications" className="text-sm font-normal">Email notifications</Label>
                      <p className="text-xs text-muted-foreground">Receive study reminders and updates</p>
                    </div>
                    <Switch id="email-notifications" />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="achievement-alerts" className="text-sm font-normal">Achievement alerts</Label>
                      <p className="text-xs text-muted-foreground">Get notified when you unlock achievements</p>
                    </div>
                    <Switch id="achievement-alerts" defaultChecked />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Privacy */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Shield size={18} className="text-muted-foreground" />
                  <h3 className="font-medium text-foreground">Privacy</h3>
                </div>
                <div className="space-y-3 ml-7">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="profile-visibility" className="text-sm font-normal">Public profile</Label>
                      <p className="text-xs text-muted-foreground">Make your profile visible to other users</p>
                    </div>
                    <Switch id="profile-visibility" />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="show-activity" className="text-sm font-normal">Show activity</Label>
                      <p className="text-xs text-muted-foreground">Display your study activity on your profile</p>
                    </div>
                    <Switch id="show-activity" defaultChecked />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Preferences */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Globe size={18} className="text-muted-foreground" />
                  <h3 className="font-medium text-foreground">Preferences</h3>
                </div>
                <div className="space-y-3 ml-7">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="auto-advance" className="text-sm font-normal">Auto-advance questions</Label>
                      <p className="text-xs text-muted-foreground">Automatically move to next question after answering</p>
                    </div>
                    <Switch id="auto-advance" defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="sound-effects" className="text-sm font-normal">Sound effects</Label>
                      <p className="text-xs text-muted-foreground">Play sounds for correct/incorrect answers</p>
                    </div>
                    <Switch id="sound-effects" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-center py-8">
                No recent activity. Start studying to see your progress here!
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
