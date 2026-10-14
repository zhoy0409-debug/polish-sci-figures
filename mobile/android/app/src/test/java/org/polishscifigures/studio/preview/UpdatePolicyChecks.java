package org.polishscifigures.studio.preview;

/** Also runnable with javac, without an Android SDK or network. */
final class UpdatePolicyChecks {
    public static void main(String[] args) { run(); System.out.println("Official update URL/version policy: all checks passed"); }
    static void run() {
        String base=UpdatePolicy.RELEASES, asset="polish-sci-figures-Studio-0.1.10-Android-preview.apk";
        check(UpdatePolicy.compare("0.1.10","0.1.9")>0,"Numeric version ordering");
        check(UpdatePolicy.compare("0.2.0","0.10.0")<0,"Numeric minor version ordering");
        check(UpdatePolicy.compare("1.0.0","1.0.0")==0,"Same version");
        for(String bad:new String[]{"v0.1.7","0.01.7","0.1.7-rc1","0.1","0.1.100000"}) {
            boolean rejected=false;try{UpdatePolicy.compare(bad,"0.1.7");}catch(IllegalArgumentException expected){rejected=true;}check(rejected,"Reject invalid version");
        }
        for(String good:new String[]{base,base+"/tag/v1.4.7",base+"/download/figure-studio-local-preview-20261014/"+asset})check(UpdatePolicy.isOfficialLink(good),"Official link should open");
        for(String bad:new String[]{"http://github.com/zhoy0409-debug/polish-sci-figures/releases",
            "https://github.com.evil.invalid/zhoy0409-debug/polish-sci-figures/releases",
            "https://secret@github.com/zhoy0409-debug/polish-sci-figures/releases",
            "https://github.com:443/zhoy0409-debug/polish-sci-figures/releases",base+"?project=secret",base+"#secret",
            base+"/tag/%76x",base+"/tag/../escape",base+"/download/v1.4.7/"+asset+"?token=private",
            base+"/download/v1.4.7/other.apk",base+"/download/v1.4.7/polish-sci-figures-Studio-0.1.7-Setup-x64.exe",
            "javascript:alert(1)","file:///private/project.json",base+"\n"})check(!UpdatePolicy.isOfficialLink(bad),"Reject non-official or wrong-platform link: "+bad);
        check(UpdatePolicy.API.equals("https://api.github.com/repos/zhoy0409-debug/polish-sci-figures/releases?per_page=30"),"Fixed public metadata endpoint");
    }
    private static void check(boolean condition,String message){if(!condition)throw new AssertionError(message);}
}
