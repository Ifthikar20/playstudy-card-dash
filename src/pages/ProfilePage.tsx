import { User, Mail, Calendar, Award, BookOpen, Zap, Settings, Bell, Shield, Globe } from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export default function ProfilePage() {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />

      <main className="airbnb-container py-8 animate-fade-in-up">
        <div className="max-w-3xl mx-auto">
          <h1 className="font-heading text-3xl font-bold text-foreground mb-8">Profile</h1>

          {/* Profile Header — Airbnb host card style */}
          <div className="airbnb-card border border-border p-8 mb-8">
            <div className="flex flex-col md:flex-row items-center gap-6">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary to-brand-deep flex items-center justify-center">
                <User size={40} className="text-white" />
              </div>
              <div className="text-center md:text-left">
                <h2 className="font-heading text-xl font-bold text-foreground">Guest User</h2>
                <p className="text-muted-foreground flex items-center justify-center md:justify-start gap-2 mt-1 text-sm">
                  <Mail size={14} />
                  Login to save your progress
                </p>
                <p className="text-sm text-muted-foreground flex items-center justify-center md:justify-start gap-2 mt-1">
                  <Calendar size={14} />
                  Joined December 2024
                </p>
              </div>
            </div>
          </div>

          {/* Stats Grid — Airbnb metric cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <div className="airbnb-card border border-border p-6">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
                <BookOpen size={14} />
                Study Sessions
              </div>
              <p className="font-heading text-3xl font-bold text-foreground">0</p>
            </div>

            <div className="airbnb-card border border-border p-6">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
                <Zap size={14} />
                Speed Runs
              </div>
              <p className="font-heading text-3xl font-bold text-foreground">0</p>
            </div>

            <div className="airbnb-card border border-border p-6">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
                <Award size={14} />
                Achievements
              </div>
              <p className="font-heading text-3xl font-bold text-foreground">0</p>
            </div>
          </div>

          {/* Settings — Airbnb clean list */}
          <div className="airbnb-card border border-border p-8 mb-8">
            <div className="flex items-center gap-2 mb-6">
              <Settings size={18} className="text-foreground" />
              <h2 className="font-heading text-lg font-semibold text-foreground">Settings</h2>
            </div>

            {/* Notifications */}
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <Bell size={16} className="text-muted-foreground" />
                <h3 className="font-medium text-foreground text-sm">Notifications</h3>
              </div>
              <div className="space-y-4 pl-6">
                <SettingRow
                  id="email-notifications"
                  label="Email notifications"
                  description="Receive study reminders and updates"
                />
                <SettingRow
                  id="achievement-alerts"
                  label="Achievement alerts"
                  description="Get notified when you unlock achievements"
                  defaultChecked
                />
              </div>
            </div>

            <div className="h-px bg-border my-6" />

            {/* Privacy */}
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <Shield size={16} className="text-muted-foreground" />
                <h3 className="font-medium text-foreground text-sm">Privacy</h3>
              </div>
              <div className="space-y-4 pl-6">
                <SettingRow
                  id="profile-visibility"
                  label="Public profile"
                  description="Make your profile visible to other users"
                />
                <SettingRow
                  id="show-activity"
                  label="Show activity"
                  description="Display your study activity on your profile"
                  defaultChecked
                />
              </div>
            </div>

            <div className="h-px bg-border my-6" />

            {/* Preferences */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Globe size={16} className="text-muted-foreground" />
                <h3 className="font-medium text-foreground text-sm">Preferences</h3>
              </div>
              <div className="space-y-4 pl-6">
                <SettingRow
                  id="auto-advance"
                  label="Auto-advance questions"
                  description="Automatically move to next question after answering"
                  defaultChecked
                />
                <SettingRow
                  id="sound-effects"
                  label="Sound effects"
                  description="Play sounds for correct/incorrect answers"
                />
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="airbnb-card border border-border p-8">
            <h2 className="font-heading text-lg font-semibold text-foreground mb-4">Recent Activity</h2>
            <p className="text-muted-foreground text-center py-10 text-sm">
              No recent activity. Start studying to see your progress here!
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

function SettingRow({ id, label, description, defaultChecked }: { id: string; label: string; description: string; defaultChecked?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <div className="space-y-0.5">
        <Label htmlFor={id} className="text-sm font-normal text-foreground">{label}</Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch id={id} defaultChecked={defaultChecked} />
    </div>
  );
}
